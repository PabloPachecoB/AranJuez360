from decimal import Decimal
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from usuarios.permissions import EsAdmin, EsCaja, EsCliente
from . import canjes
from .models import Cupon, Recompensa
from .services import ReglaNegocioError


class OperacionThrottle(UserRateThrottle):
    rate = "30/min"


class RecompensaSerializer(serializers.ModelSerializer):
    negocio_id = serializers.PrimaryKeyRelatedField(
        source="empresa", queryset=Recompensa._meta.get_field("empresa").remote_field.model.objects.filter(
            activo=True
        ), allow_null=True, required=False,
    )
    negocio_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)
    costo_puntos = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))

    class Meta:
        model = Recompensa
        fields = ["id", "nombre", "descripcion", "costo_puntos", "negocio_id",
                  "negocio_nombre", "activo", "creado_en"]
        read_only_fields = ["id", "creado_en"]

    def validate(self, attrs):
        negocio = attrs.get("empresa", getattr(self.instance, "empresa", None))
        if attrs.get("activo", getattr(self.instance, "activo", True)) and negocio and (not negocio.activo or negocio.tipo == "OFICINA"):
            raise serializers.ValidationError("Elige un negocio activo o un beneficio del Paseo.")
        return attrs



class CuponSerializer(serializers.ModelSerializer):
    negocio_id = serializers.IntegerField(read_only=True)
    negocio_nombre = serializers.CharField(source="negocio.nombre", read_only=True, default=None)

    class Meta:
        model = Cupon
        fields = ["id", "recompensa_id", "nombre", "descripcion", "costo_puntos", "codigo",
                  "negocio_id", "negocio_nombre", "estado", "creado_en", "usado_en"]
        read_only_fields = fields


class EmisionSerializer(serializers.Serializer):
    clave_operacion = serializers.UUIDField()


class CodigoSerializer(serializers.Serializer):
    codigo = serializers.RegexField(r"^(?:[a-fA-F0-9]{24}|[A-HJ-NP-Z2-9]{8})$")


def ejecutar(fn, *args):
    try:
        return fn(*args)
    except ReglaNegocioError as exc:
        raise ValidationError({"detail": str(exc)})


class RecompensasViewSet(viewsets.GenericViewSet):
    lookup_value_regex = r"\d+"
    serializer_class = RecompensaSerializer
    throttle_classes = [OperacionThrottle]

    def get_permissions(self):
        permiso = EsCliente if self.action == "canjear" else (
            EsAdmin if self.action in ("create", "update", "partial_update") else IsAuthenticated
        )
        return [permiso()]

    def get_queryset(self):
        qs = Recompensa.objects.select_related("empresa")
        if self.request.user.rol != "ADMIN":
            qs = qs.filter(activo=True).exclude(empresa__activo=False).exclude(empresa__tipo="OFICINA")
        return qs

    def list(self, request):
        pagina = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(self.get_serializer(pagina, many=True).data)

    def create(self, request):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        entrada.save()
        return Response(entrada.data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None, partial=False):
        entrada = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        entrada.is_valid(raise_exception=True)
        entrada.save()
        return Response(entrada.data)

    def partial_update(self, request, pk=None):
        return self.update(request, pk, partial=True)

    @action(detail=True, methods=["post"])
    def canjear(self, request, pk=None):
        entrada = EmisionSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        # No filtrar por activo antes del servicio: reintentos deben recuperar cupones ya emitidos.
        cupon, creado = ejecutar(canjes.emitir_cupon, request.user, int(pk),
                                entrada.validated_data["clave_operacion"])
        return Response(CuponSerializer(cupon).data, status=201 if creado else 200)


class CuponesViewSet(viewsets.GenericViewSet):
    serializer_class = CuponSerializer
    permission_classes = [EsCliente]

    def list(self, request):
        qs = Cupon.objects.filter(cliente=request.user).select_related("negocio")
        pagina = self.paginate_queryset(qs)
        return self.get_paginated_response(self.get_serializer(pagina, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([OperacionThrottle])
def consultar(request):
    entrada = CodigoSerializer(data=request.data)
    entrada.is_valid(raise_exception=True)
    return Response(CuponSerializer(ejecutar(canjes.consultar_cupon,
                   entrada.validated_data["codigo"], request.user)).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([OperacionThrottle])
def validar(request):
    entrada = CodigoSerializer(data=request.data)
    entrada.is_valid(raise_exception=True)
    return Response(CuponSerializer(ejecutar(canjes.validar_cupon,
                   entrada.validated_data["codigo"], request.user)).data)
