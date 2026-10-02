from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from usuarios.permissions import EsAdmin, EsCaja, EsCliente, EsPortero

from . import services
from .models import ConfiguracionPuntos, MovimientoPuntos, SolicitudPuntos, Visita
from .serializers import (
    ConfiguracionPuntosSerializer,
    CrearSolicitudSerializer,
    EmpresaEscaneadaSerializer,
    MovimientoSerializer,
    RechazoSerializer,
    RegistrarVisitaSerializer,
    SolicitudSerializer,
    VisitaSerializer,
)


def _regla(fn, *args, **kwargs):
    """Traduce errores de dominio a respuestas HTTP."""
    try:
        return fn(*args, **kwargs)
    except services.ReglaNegocioError as exc:
        raise ValidationError({"detail": str(exc)})
    except SolicitudPuntos.DoesNotExist:
        raise NotFound("Solicitud no encontrada.")


# --- App del cliente ----------------------------------------------------------

@api_view(["GET"])
@permission_classes([EsCliente])
def mi_qr(request):
    """QR personal que el cliente muestra al portero. La app lo renueva antes de vencer."""
    return Response(services.generar_qr_cliente(request.user))


@api_view(["GET"])
@permission_classes([EsCliente])
def empresa_escaneada(request, codigo):
    """Paso 1: el cliente escaneó el QR/NFC; mostrar nombre y logo de la empresa."""
    empresa = _regla(services.empresa_por_codigo, codigo)
    return Response(EmpresaEscaneadaSerializer(empresa, context={"request": request}).data)


class MisSolicitudesViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """Paso 2: el cliente envía NIT + monto. Queda PENDIENTE hasta que caja apruebe.

    La verificación de identidad (huella / Face ID) se hace en la app antes de
    llamar a este endpoint.
    """

    serializer_class = SolicitudSerializer
    permission_classes = [EsCliente]

    def get_queryset(self):
        return SolicitudPuntos.objects.filter(cliente=self.request.user).select_related("empresa")

    def create(self, request):
        entrada = CrearSolicitudSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        solicitud = _regla(services.crear_solicitud, request.user, **entrada.validated_data)
        data = SolicitudSerializer(solicitud, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class MisMovimientosViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = MovimientoSerializer
    permission_classes = [EsCliente]

    def get_queryset(self):
        return MovimientoPuntos.objects.filter(cliente=self.request.user).select_related("empresa")


# --- Caja del establecimiento ---------------------------------------------------

class CajaSolicitudesViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Paso 3: caja ve la solicitud, la compara con el ticket y acepta o rechaza."""

    serializer_class = SolicitudSerializer
    permission_classes = [EsCaja]

    def get_queryset(self):
        qs = SolicitudPuntos.objects.filter(empresa=self.request.user.empresa).select_related(
            "empresa", "cliente"
        )
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado.upper())
        return qs

    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        solicitud = _regla(services.aprobar_solicitud, int(pk), request.user)
        return Response(self.get_serializer(solicitud).data)

    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        entrada = RechazoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        solicitud = _regla(
            services.rechazar_solicitud, int(pk), request.user, entrada.validated_data.get("motivo", "")
        )
        return Response(self.get_serializer(solicitud).data)


# --- Portería -------------------------------------------------------------------

class PorteriaVisitasViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """El portero escanea el QR del cliente y registra su ingreso."""

    serializer_class = VisitaSerializer
    permission_classes = [EsPortero]

    def get_queryset(self):
        return Visita.objects.filter(
            portero=self.request.user, creado_en__date=timezone.localdate()
        ).select_related("cliente", "portero")

    def create(self, request):
        entrada = RegistrarVisitaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        visita = _regla(services.registrar_visita, entrada.validated_data["token"], request.user)
        data = VisitaSerializer(visita).data
        data["mensaje"] = (
            f"+{visita.puntos} punto(s) acreditado(s)." if visita.puntos
            else "Ingreso registrado. Ya sumó sus puntos de visita de hoy."
        )
        return Response(data, status=status.HTTP_201_CREATED)


# --- Vista administrativa -----------------------------------------------------

@api_view(["GET", "PUT"])
@permission_classes([EsAdmin])
def configuracion_puntos(request):
    config = ConfiguracionPuntos.actual()
    if request.method == "GET":
        return Response(ConfiguracionPuntosSerializer(config).data)
    serializer = ConfiguracionPuntosSerializer(config, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


class SolicitudesAdminViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Registros de todas las empresas, filtrables por empresa y estado."""

    serializer_class = SolicitudSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        qs = SolicitudPuntos.objects.select_related("empresa", "cliente")
        params = self.request.query_params
        if params.get("empresa"):
            qs = qs.filter(empresa_id=params["empresa"])
        if params.get("estado"):
            qs = qs.filter(estado=params["estado"].upper())
        return qs


class VisitasAdminViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Ingresos al Paseo registrados por portería, filtrables por fecha (YYYY-MM-DD)."""

    serializer_class = VisitaSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        qs = Visita.objects.select_related("cliente", "portero")
        fecha = self.request.query_params.get("fecha")
        if fecha:
            qs = qs.filter(creado_en__date=fecha)
        return qs
