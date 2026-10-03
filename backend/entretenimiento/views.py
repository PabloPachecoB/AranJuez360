from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from fidelizacion.models import PuntoEscaneo
from fidelizacion.services import ReglaNegocioError
from usuarios.permissions import EsAdmin, EsCliente

from . import services

from .models import Evento, Funcion, Pelicula, ReservaCine
from .serializers import (
    ActividadSerializer,
    EventoSerializer,
    FuncionSerializer,
    PeliculaSerializer,
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
        .select_related("empresa")
        .order_by("inicio")
    )


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
    queryset = Evento.objects.select_related("empresa").order_by("-inicio")


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
