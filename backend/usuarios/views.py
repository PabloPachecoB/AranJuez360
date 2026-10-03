from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from . import services, verificacion
from .models import CodigoVerificacion, Usuario
from .permissions import EsAdmin
from .serializers import (
    CambiarPasswordSerializer,
    DesafioSerializer,
    LoginSerializer,
    VerificarCodigoSerializer,
    PorteroSerializer,
    UsuarioAdminSerializer,
    RegistroClienteSerializer,
    UsuarioSerializer,
)


def _paso_codigo(registro, paso: str):
    return {
        "paso": paso,
        "desafio": str(registro.desafio),
        "email": registro.usuario.email,
        "vence_en_minutos": settings.CODIGO_VERIFICACION_MINUTOS,
    }


def _codigo_error(fn, *args):
    try:
        return fn(*args)
    except verificacion.CodigoError as exc:
        raise ValidationError({"detail": str(exc)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def registro(request):
    """Alta de clientes desde la app. Envía un código al correo para verificarlo;
    la sesión se entrega recién al validar el código (verificar-codigo)."""
    serializer = RegistroClienteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        user = serializer.save()
        codigo = verificacion.emitir_codigo(user, CodigoVerificacion.Proposito.VERIFICAR_EMAIL)
    return Response(_paso_codigo(codigo, "verificar_correo"), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def login(request):
    """Acceso directo con correo y contraseña. No revela si el correo existe."""
    entrada = LoginSerializer(data=request.data)
    entrada.is_valid(raise_exception=True)
    user = authenticate(
        request,
        username=entrada.validated_data["email"].strip().lower(),
        password=entrada.validated_data["password"],
    )
    if user is None:
        raise ValidationError({"detail": "Correo o contraseña incorrectos."})
    refresh = RefreshToken.for_user(user)
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "usuario": UsuarioSerializer(user).data,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def verificar_codigo(request):
    """Paso 2: valida el código del correo y entrega los tokens de sesión."""
    entrada = VerificarCodigoSerializer(data=request.data)
    entrada.is_valid(raise_exception=True)
    user = _codigo_error(
        verificacion.verificar_codigo, entrada.validated_data["desafio"], entrada.validated_data["codigo"]
    )
    refresh = RefreshToken.for_user(user)
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "usuario": UsuarioSerializer(user).data,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([ScopedRateThrottle])
def reenviar_codigo(request):
    entrada = DesafioSerializer(data=request.data)
    entrada.is_valid(raise_exception=True)
    nuevo = _codigo_error(verificacion.reenviar_codigo, entrada.validated_data["desafio"])
    paso = "verificar_correo" if nuevo.proposito == CodigoVerificacion.Proposito.VERIFICAR_EMAIL else "codigo_login"
    return Response(_paso_codigo(nuevo, paso))


for _vista in (registro, login, verificar_codigo, reenviar_codigo):
    _vista.cls.throttle_scope = "auth"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def yo(request):
    return Response(UsuarioSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cambiar_password(request):
    serializer = CambiarPasswordSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    user = request.user
    user.set_password(serializer.validated_data["password_nueva"])
    user.debe_cambiar_password = False
    user.save(update_fields=["password", "debe_cambiar_password"])
    return Response({"status": "ok"})


class PorteroAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Porteros del Paseo. No se borran: se desactivan (is_active=false)."""

    serializer_class = PorteroSerializer
    permission_classes = [EsAdmin]
    queryset = Usuario.objects.filter(rol=Usuario.Rol.PORTERO).order_by("first_name")

    def perform_create(self, serializer):
        datos = serializer.validated_data
        nombre = f"{datos['first_name']} {datos.get('last_name', '')}".strip()
        email = datos.pop("email")
        serializer.instance = services.crear_cuenta_con_acceso(
            email, Usuario.Rol.PORTERO, nombre, **datos
        )

    def perform_update(self, serializer):
        email = serializer.validated_data.get("email")
        if email:
            serializer.save(username=email)
        else:
            serializer.save()

    @action(detail=True, methods=["post"], url_path="reenviar-acceso")
    def reenviar_acceso(self, request, pk=None):
        portero = self.get_object()
        services.reenviar_acceso(portero, portero.get_full_name() or portero.username)
        return Response({"status": "enviado", "email": portero.email})


class UsuarioAdminViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """Todos los usuarios: filtros ?rol=&activo=true|false&sin_activar=true&buscar=."""

    serializer_class = UsuarioAdminSerializer
    permission_classes = [EsAdmin]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        qs = Usuario.objects.select_related("empresa").order_by("-date_joined")
        params = self.request.query_params
        if params.get("rol"):
            qs = qs.filter(rol=params["rol"].upper())
        if params.get("activo") in ("true", "false"):
            qs = qs.filter(is_active=params["activo"] == "true")
        if params.get("sin_activar") == "true":
            qs = qs.filter(debe_cambiar_password=True)
        if params.get("buscar"):
            b = params["buscar"]
            qs = qs.filter(
                Q(email__icontains=b) | Q(first_name__icontains=b) | Q(last_name__icontains=b)
            )
        return qs

    def perform_update(self, serializer):
        if serializer.instance == self.request.user and serializer.validated_data.get("is_active") is False:
            raise ValidationError({"is_active": "No puedes desactivar tu propia cuenta."})
        serializer.save()
