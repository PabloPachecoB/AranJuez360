from datetime import timedelta

from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from fidelizacion.models import PuntoEscaneo
from fidelizacion.services import ReglaNegocioError
from usuarios.permissions import EsAdmin, EsCliente, EsPortero

from . import escenario, services

from .models import Espacio, Evento, Funcion, Pelicula, Propuesta, ReservaCine, ReservaEvento
from .serializers import (
    ActividadSerializer,
    EspacioSerializer,
    EventoSerializer,
    FuncionSerializer,
    PeliculaSerializer,
    PropuestaAdminSerializer,
    PropuestaSerializer,
    ReservaEventoSerializer,
    ReservaSerializer,
)

MAX_EVENTOS = 20


def _cartelera():
    """Películas activas con sus funciones futuras precargadas (la ventana la aplica el serializer)."""
    futuras = Funcion.objects.filter(inicio__gte=timezone.now()).order_by("inicio")
    return Pelicula.objects.filter(activo=True).select_related("cine").prefetch_related(
        Prefetch("funciones", queryset=futuras)
    )


def _eventos_proximos():
    ahora = timezone.now()
    # Incluye los que están en curso (empezaron pero no terminaron).
    return (
        Evento.objects.filter(activo=True)
        .filter(Q(inicio__gte=ahora) | Q(fin__gte=ahora))
        .select_related("empresa", "espacio", "propuesta")
        .order_by("inicio")
    )


def _regla(funcion, *args, **kwargs):
    try:
        return funcion(*args, **kwargs)
    except ReglaNegocioError as exc:
        raise ValidationError({"detail": str(exc)})


@api_view(["GET"])
@permission_classes([AllowAny])
def resumen(request):
    """Todo lo de la sección Diversión de la app en una sola llamada."""
    eventos = list(_eventos_proximos()[:MAX_EVENTOS])
    destacado = next((e for e in eventos if e.destacado), eventos[0] if eventos else None)
    contexto = {"request": request}
    peliculas = PeliculaSerializer(_cartelera(), many=True, context=contexto).data
    return Response({
        # Primero las que tienen funciones; las demás quedan como "próximamente".
        "cartelera": sorted(peliculas, key=lambda p: not p["funciones"]),
        "eventos": EventoSerializer(eventos, many=True, context=contexto).data,
        "destacado": EventoSerializer(destacado, context=contexto).data if destacado else None,
        "actividades": ActividadSerializer(
            PuntoEscaneo.objects.filter(activo=True, tipo=PuntoEscaneo.Tipo.ACTIVIDAD).select_related("empresa"),
            many=True,
        ).data,
    })


class PeliculaPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PeliculaSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return _cartelera()


class PeliculasAdminViewSet(viewsets.ModelViewSet):
    serializer_class = PeliculaSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        return Pelicula.objects.select_related("cine").prefetch_related("funciones")


class FuncionesAdminViewSet(viewsets.ModelViewSet):
    serializer_class = FuncionSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        qs = Funcion.objects.select_related("pelicula")
        if self.request.query_params.get("pelicula"):
            qs = qs.filter(pelicula_id=self.request.query_params["pelicula"])
        return qs


class EventosAdminViewSet(viewsets.ModelViewSet):
    serializer_class = EventoSerializer
    permission_classes = [EsAdmin]
    queryset = Evento.objects.select_related("empresa", "espacio", "propuesta").order_by("-inicio")

    @action(detail=True, methods=["get"])
    def asistentes(self, request, pk=None):
        """Quiénes reservaron cupo (para el organizador y la puerta)."""
        reservas = self.get_object().reservas.filter(estado=ReservaEvento.Estado.CONFIRMADA).select_related("cliente")
        return Response(ReservaEventoSerializer(reservas, many=True).data)


# ---------- Escenario abierto ----------

class EspaciosViewSet(viewsets.ReadOnlyModelViewSet):
    """Espacios que la comunidad puede pedir para presentarse."""

    serializer_class = EspacioSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    queryset = Espacio.objects.filter(activo=True)


class EspaciosAdminViewSet(viewsets.ModelViewSet):
    serializer_class = EspacioSerializer
    permission_classes = [EsAdmin]
    queryset = Espacio.objects.all()


class MisPropuestasViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                           viewsets.GenericViewSet):
    """Solicitudes del cliente para presentarse (le llegan al admin para aprobar)."""

    serializer_class = PropuestaSerializer
    permission_classes = [EsCliente]

    def get_queryset(self):
        return Propuesta.objects.filter(solicitante=self.request.user).select_related("espacio", "evento")

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = dict(serializer.validated_data)
        datos["espacio"] = datos["espacio"].pk
        propuesta = _regla(escenario.crear_propuesta, request.user, datos)
        return Response(PropuestaSerializer(propuesta).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        return Response(PropuestaSerializer(_regla(escenario.cancelar_propuesta, request.user, pk)).data)


class PropuestasAdminViewSet(viewsets.ReadOnlyModelViewSet):
    """Bandeja del admin: aprobar (publica el evento) o rechazar con motivo."""

    serializer_class = PropuestaAdminSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        qs = Propuesta.objects.select_related("espacio", "solicitante", "evento", "revisada_por")
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        # Las pendientes, por fecha de presentación (lo más urgente primero).
        return qs.order_by("inicio") if estado == Propuesta.Estado.PENDIENTE else qs

    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        datos = request.data
        propuesta = _regla(
            escenario.aprobar, pk, request.user, acceso=datos.get("acceso"), cupos=datos.get("cupos"),
            destacado=datos.get("destacado") in (True, "true", "1"),
        )
        return Response(PropuestaAdminSerializer(propuesta).data)

    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        propuesta = _regla(escenario.rechazar, pk, request.user, request.data.get("motivo", ""))
        return Response(PropuestaAdminSerializer(propuesta).data)


class MisEntradasViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Cupos reservados por el cliente en eventos con cupos (cada uno con su QR)."""

    serializer_class = ReservaEventoSerializer
    permission_classes = [EsCliente]
    pagination_class = None

    def get_queryset(self):
        return ReservaEvento.objects.filter(
            cliente=self.request.user, estado=ReservaEvento.Estado.CONFIRMADA,
            evento__inicio__gte=timezone.now() - timedelta(hours=6),
        ).select_related("evento", "cliente").order_by("evento__inicio")

    def create(self, request):
        reserva = _regla(escenario.reservar, request.user, request.data.get("evento"), request.data.get("cantidad", 1))
        return Response(ReservaEventoSerializer(reserva).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        return Response(ReservaEventoSerializer(_regla(escenario.cancelar_reserva, request.user, pk)).data)


@api_view(["GET", "POST"])
@permission_classes([EsPortero | EsAdmin])
def entrada_evento(request, codigo):
    """GET valida la entrada (QR `paseo360://evento/<codigo>`); POST registra el ingreso."""
    if request.method == "GET":
        return Response(ReservaEventoSerializer(_regla(escenario._entrada, codigo)).data)
    reserva = _regla(escenario.registrar_ingreso, codigo)
    data = ReservaEventoSerializer(reserva).data
    data["mensaje"] = f"Ingreso registrado: {data['cliente_nombre']} · {reserva.cantidad} × {reserva.evento.titulo}."
    return Response(data)


class MisReservasViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Entradas de cine del cliente: reservar (monedas o boletería) y cancelar."""

    serializer_class = ReservaSerializer
    permission_classes = [EsCliente]

    def get_queryset(self):
        return ReservaCine.objects.filter(cliente=self.request.user).select_related("funcion__pelicula")

    def create(self, request):
        datos = request.data
        try:
            reserva = services.reservar(
                request.user, datos.get("funcion"), int(datos.get("cantidad") or 0), datos.get("metodo", "")
            )
        except (ReglaNegocioError, ValueError) as exc:
            raise ValidationError({"detail": str(exc) or "Datos de reserva no válidos."})
        return Response(ReservaSerializer(reserva).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        try:
            reserva = services.cancelar(request.user, pk)
        except ReglaNegocioError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(ReservaSerializer(reserva).data)
