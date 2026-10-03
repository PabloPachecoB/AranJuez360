from django.conf import settings
from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from usuarios.models import CodigoVerificacion
from usuarios.permissions import EsAdmin, EsEmpresa
from usuarios import verificacion

from . import services
from .models import Categoria, Empresa, Horario, Oferta, Producto
from .serializers import (
    CategoriaSerializer,
    EmpresaAdminSerializer,
    EmpresaPerfilSerializer,
    EmpresaPublicaDetalleSerializer,
    EmpresaPublicaListSerializer,
    HorarioSerializer,
    OfertaSerializer,
    ProductoPublicoSerializer,
    ProductoSerializer,
    RegistroEmpresaSerializer,
)

PARSERS = [JSONParser, MultiPartParser, FormParser]


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def registro_negocio(request):
    """Autorregistro de negocio/emprendimiento: crea la cuenta y envía un
    código de verificación al correo — mismo mecanismo que el registro de
    clientes. La sesión se entrega recién en /auth/verificar-codigo/ (el
    endpoint compartido ya existente; no hace falta uno nuevo)."""
    serializer = RegistroEmpresaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    datos = serializer.validated_data
    with transaction.atomic():
        usuario = services.registrar_negocio_propio(
            nombre=datos["nombre"],
            tipo=datos["tipo"],
            categoria=datos["categoria"],
            email=datos["email"],
            telefono=datos.get("telefono", ""),
            password=datos["password"],
        )
        codigo = verificacion.emitir_codigo(usuario, CodigoVerificacion.Proposito.VERIFICAR_EMAIL)
    return Response(
        {
            "paso": "verificar_correo",
            "desafio": str(codigo.desafio),
            "email": usuario.email,
            "vence_en_minutos": settings.CODIGO_VERIFICACION_MINUTOS,
        },
        status=status.HTTP_201_CREATED,
    )


registro_negocio.cls.throttle_scope = "auth"


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


class CategoriaPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class ProductoPublicoViewSet(viewsets.ReadOnlyModelViewSet):
    """Buscador global de PaseoYa (Reto 3, sección 5.11): un producto puede
    buscarse sin importar a qué negocio pertenece."""

    serializer_class = ProductoPublicoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Producto.objects.filter(activo=True, empresa__activo=True).select_related("empresa")
        params = self.request.query_params
        if params.get("buscar"):
            qs = qs.filter(nombre__icontains=params["buscar"])
        if params.get("empresa"):
            qs = qs.filter(empresa_id=params["empresa"])
        return qs
