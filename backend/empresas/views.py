from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from usuarios.permissions import EsAdmin, EsEmpresa

from . import services
from .models import Categoria, Empresa, FotoEmpresa, Horario, InvitacionEmpresa, Oferta, Producto
from .serializers import (
    AceptarInvitacionSerializer,
    CrearInvitacionSerializer,
    InvitacionEmpresaSerializer,
    FotoEmpresaSerializer,
    OfertaPublicaSerializer,
    CategoriaSerializer,
    EmpresaAdminSerializer,
    EmpresaPerfilSerializer,
    EmpresaPublicaDetalleSerializer,
    EmpresaPublicaListSerializer,
    HorarioSerializer,
    OfertaSerializer,
    ProductoSerializer,
)

PARSERS = [JSONParser, MultiPartParser, FormParser]


# --- Vista administrativa -----------------------------------------------------

class CategoriaAdminViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [EsAdmin]


class EmpresaAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Registro de establecimientos. No se borran: se desactivan."""

    queryset = Empresa.objects.select_related("categoria").prefetch_related("horarios")
    serializer_class = EmpresaAdminSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("tipo"):
            qs = qs.filter(tipo=params["tipo"])
        if params.get("activo") in ("true", "false"):
            qs = qs.filter(activo=params["activo"] == "true")
        if params.get("buscar"):
            qs = qs.filter(nombre__icontains=params["buscar"])
        return qs

    def perform_create(self, serializer):
        serializer.instance = services.crear_empresa_con_acceso(**serializer.validated_data)

    @action(detail=True, methods=["post"], url_path="reenviar-acceso")
    def reenviar_acceso(self, request, pk=None):
        usuario = services.reenviar_acceso(self.get_object())
        return Response({"status": "enviado", "email": usuario.email})


# --- Panel de la empresa ------------------------------------------------------

class MiEmpresaViewSet(viewsets.GenericViewSet):
    """Ficha propia: GET/PATCH, horarios y código QR/NFC de fidelización."""

    serializer_class = EmpresaPerfilSerializer
    permission_classes = [EsEmpresa]
    parser_classes = PARSERS

    def get_object(self):
        return self.request.user.empresa

    def perfil(self, request):
        if request.method == "GET":
            return Response(self.get_serializer(self.get_object()).data)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["get", "put"])
    def horarios(self, request):
        """PUT reemplaza la semana completa: lista de {dia, abre, cierra, cerrado}."""
        empresa = self.get_object()
        if request.method == "GET":
            return Response(HorarioSerializer(empresa.horarios.all(), many=True).data)

        serializer = HorarioSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        dias = [h["dia"] for h in serializer.validated_data]
        if len(dias) != len(set(dias)):
            return Response({"detail": "Hay días repetidos."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            empresa.horarios.all().delete()
            Horario.objects.bulk_create(
                Horario(empresa=empresa, **h) for h in serializer.validated_data
            )
        return Response(HorarioSerializer(empresa.horarios.all(), many=True).data)

    def _empresa_con_caja(self):
        empresa = self.get_object()
        if empresa.tipo == Empresa.Tipo.OFICINA:
            raise PermissionDenied("Las oficinas no tienen caja de puntos.")
        return empresa

    @staticmethod
    def _codigo_response(empresa):
        return Response({
            "codigo": empresa.codigo_fidelizacion,
            "enlace": f"{settings.APP_DEEP_LINK}/puntos/{empresa.codigo_fidelizacion}",
        })

    @action(detail=False, methods=["get"])
    def codigo(self, request):
        """Contenido a imprimir en el QR y grabar en el sticker NFC de caja."""
        return self._codigo_response(self._empresa_con_caja())

    @action(detail=False, methods=["post"], url_path="codigo/regenerar")
    def regenerar_codigo(self, request):
        empresa = services.regenerar_codigo_fidelizacion(self._empresa_con_caja())
        return self._codigo_response(empresa)


class _DeMiEmpresaViewSet(viewsets.ModelViewSet):
    permission_classes = [EsEmpresa]
    parser_classes = PARSERS

    def get_queryset(self):
        return self.model.objects.filter(empresa=self.request.user.empresa)

    def perform_create(self, serializer):
        serializer.save(empresa=self.request.user.empresa)


class MisProductosViewSet(_DeMiEmpresaViewSet):
    model = Producto
    serializer_class = ProductoSerializer


class MisFotosViewSet(_DeMiEmpresaViewSet):
    """Galería del mini-sitio (subir con multipart: imagen, titulo, orden)."""

    model = FotoEmpresa
    serializer_class = FotoEmpresaSerializer


class MisOfertasViewSet(_DeMiEmpresaViewSet):
    model = Oferta
    serializer_class = OfertaSerializer


# --- Público (app y web) --------------------------------------------------------

class EmpresaPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    """Directorio del Paseo: solo empresas activas."""

    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Empresa.objects.filter(activo=True).select_related("categoria")
        params = self.request.query_params
        if params.get("categoria"):
            qs = qs.filter(categoria_id=params["categoria"])
        if params.get("tipo"):
            qs = qs.filter(tipo=params["tipo"])
        if params.get("buscar"):
            qs = qs.filter(nombre__icontains=params["buscar"])
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EmpresaPublicaDetalleSerializer
        return EmpresaPublicaListSerializer


class OfertaPublicaViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Ofertas vigentes hoy de negocios activos (pantalla de Inicio de la app)."""

    serializer_class = OfertaPublicaSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        hoy = timezone.localdate()
        return (
            Oferta.objects.filter(activo=True, empresa__activo=True, inicio__lte=hoy, fin__gte=hoy)
            .select_related("empresa", "producto")
            .order_by("fin")[:20]
        )


class CategoriaPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [AllowAny]
    pagination_class = None



# --- Alta por invitación --------------------------------------------------------------

def _invitacion(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except services.InvitacionError as exc:
        raise ValidationError({"detail": str(exc)})


class InvitacionesEmpresaAdminViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """El admin invita por correo a negocios, emprendimientos, oficinas o encargados."""

    serializer_class = InvitacionEmpresaSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        qs = InvitacionEmpresa.objects.select_related("categoria", "empresa", "aceptada_por")
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado.upper())
        return qs

    def create(self, request):
        datos = CrearInvitacionSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        invitacion = _invitacion(services.invitar, request.user, **datos.validated_data)
        return Response(InvitacionEmpresaSerializer(invitacion).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def reenviar(self, request, pk=None):
        invitacion = _invitacion(services.reenviar_invitacion, self.get_object())
        return Response(InvitacionEmpresaSerializer(invitacion).data)

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        invitacion = _invitacion(services.anular_invitacion, self.get_object())
        return Response(InvitacionEmpresaSerializer(invitacion).data)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def invitacion_empresa(request, token):
    """Enlace del correo. GET: datos de la invitación. POST: el invitado crea su cuenta."""
    invitacion = _invitacion(services.invitacion_vigente, token)
    if request.method == "GET":
        return Response({
            "email": invitacion.email,
            "tipo": invitacion.tipo,
            "tipo_nombre": invitacion.get_tipo_display(),
            "nombre_sugerido": invitacion.nombre_sugerido,
            "categoria_nombre": invitacion.categoria.nombre if invitacion.categoria else None,
            "empresa_nombre": invitacion.empresa.nombre if invitacion.empresa else None,
            "mensaje": invitacion.mensaje,
            "expira_en": invitacion.expira_en,
        })
    datos = AceptarInvitacionSerializer(data=request.data, context={"invitacion": invitacion})
    datos.is_valid(raise_exception=True)
    d = datos.validated_data
    usuario = _invitacion(
        services.aceptar_invitacion, token, d.get("nombre_empresa", ""), d["first_name"], d["last_name"], d["password"]
    )
    return Response({"email": usuario.email, "empresa": usuario.empresa.nombre}, status=status.HTTP_201_CREATED)
