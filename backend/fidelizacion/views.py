from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from usuarios.permissions import EsAdmin, EsCaja, EsCliente, EsEmpresa, EsPortero

from . import services
from .models import (
    Canje,
    ConfiguracionPuntos,
    MovimientoPuntos,
    PuntoEscaneo,
    RangoCompra,
    Recompensa,
    SolicitudPuntos,
    Visita,
)
from .serializers import (
    CanjeNegocioSerializer,
    RecompensaClienteSerializer,
    RecompensaNegocioSerializer,
    CanjeSerializer,
    ConfiguracionPuntosSerializer,
    CrearSolicitudSerializer,
    EmpresaEscaneadaSerializer,
    EscanearSerializer,
    MovimientoSerializer,
    PuntoEscaneadoSerializer,
    PuntoEscaneoSerializer,
    RangoCompraSerializer,
    RechazoSerializer,
    RecompensaSerializer,
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
def mi_monedero(request):
    """Monedero de la app: saldo y cuánto falta para la siguiente recompensa."""
    return Response(services.monedero(request.user))


class RecompensasClienteViewSet(viewsets.ReadOnlyModelViewSet):
    """Catálogo de recompensas activas para el cliente."""

    serializer_class = RecompensaClienteSerializer  # sin el valor en Bs
    permission_classes = [EsCliente]
    queryset = Recompensa.objects.filter(activo=True).select_related("empresa")

    @action(detail=True, methods=["post"])
    def canjear(self, request, pk=None):
        """Descuenta las monedas y devuelve el cupón con su código."""
        canje = _regla(services.canjear_recompensa, request.user, pk)
        return Response(CanjeSerializer(canje).data, status=status.HTTP_201_CREATED)


class MisCanjesViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = CanjeSerializer
    permission_classes = [EsCliente]

    def get_queryset(self):
        return Canje.objects.filter(cliente=self.request.user).select_related("recompensa__empresa")


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


@api_view(["GET"])
@permission_classes([EsCliente])
def resolver_codigo(request, codigo):
    """El escáner único de la app: dice si el código es la caja de un negocio (compra)
    o un punto de escaneo del Paseo (puerta, juegos…)."""
    resultado = _regla(services.resolver_codigo, codigo)
    if resultado["tipo"] == "COMPRA":
        empresa = EmpresaEscaneadaSerializer(resultado["empresa"], context={"request": request}).data
        return Response({"tipo": "COMPRA", "empresa": empresa})
    return Response({"tipo": resultado["tipo"], "punto": PuntoEscaneadoSerializer(resultado["punto"]).data})


@api_view(["POST"])
@permission_classes([EsCliente])
def escanear(request):
    """Acredita las monedas de la puerta (visita) o de una actividad."""
    entrada = EscanearSerializer(data=request.data)
    entrada.is_valid(raise_exception=True)
    resultado = _regla(services.escanear_punto, request.user, entrada.validated_data["codigo"])
    return Response(resultado, status=status.HTTP_201_CREATED)


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
            f"+{visita.puntos} monedas acreditadas." if visita.puntos
            else "Ingreso registrado. Ya sumó su visita en las últimas horas."
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


class RecompensasAdminViewSet(viewsets.ModelViewSet):
    """Catálogo de recompensas (lo administra el Paseo)."""

    serializer_class = RecompensaSerializer
    permission_classes = [EsAdmin]
    queryset = Recompensa.objects.select_related("empresa")


class PuntosEscaneoAdminViewSet(viewsets.ModelViewSet):
    """NFC/QR del Paseo que dan monedas: puerta principal, juegos, cine…"""

    serializer_class = PuntoEscaneoSerializer
    permission_classes = [EsAdmin]
    queryset = PuntoEscaneo.objects.select_related("empresa")


class RangosCompraAdminViewSet(viewsets.ModelViewSet):
    """Monedas por compra según el rango del monto."""

    serializer_class = RangoCompraSerializer
    permission_classes = [EsAdmin]
    queryset = RangoCompra.objects.all()
    pagination_class = None



# --- Catálogo de canje de cada negocio ---------------------------------------------------

class _ConCajaMixin:
    def _empresa(self):
        empresa = self.request.user.empresa
        if empresa.tipo == "OFICINA":
            raise ValidationError({"detail": "Las oficinas no tienen catálogo de canje."})
        return empresa


class MisRecompensasViewSet(_ConCajaMixin, viewsets.ModelViewSet):
    """El negocio publica sus productos para canjear con monedas (y ve el costo sugerido)."""

    serializer_class = RecompensaNegocioSerializer
    permission_classes = [EsEmpresa]

    def get_queryset(self):
        return Recompensa.objects.filter(empresa=self._empresa()).prefetch_related("canjes")

    def perform_create(self, serializer):
        serializer.save(empresa=self._empresa())


class CanjesRecibidosViewSet(_ConCajaMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Cupones que los clientes canjearon con productos de este negocio."""

    serializer_class = CanjeNegocioSerializer
    permission_classes = [EsEmpresa]

    def get_queryset(self):
        return Canje.objects.filter(recompensa__empresa=self._empresa()).select_related("recompensa", "cliente")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def conversion(request):
    """Cómo funciona la escala de monedas. Solo admin y negocios (el cliente no ve los Bs)."""
    if request.user.rol not in ("ADMIN", "NEGOCIO", "CAJERO"):
        raise NotFound()
    return Response(services.conversion())


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def validar_canje(request, codigo):
    """GET: qué premio es el cupón. POST: marcarlo como entregado.

    Los premios de un negocio los valida ese negocio (dueño o cajero); los del Paseo
    (parqueo, cine), el admin.
    """
    if request.method == "GET":
        canje = _regla(services.canje_por_codigo, request.user, codigo)
    else:
        canje = _regla(services.usar_canje, request.user, codigo)
    return Response(CanjeNegocioSerializer(canje).data)
