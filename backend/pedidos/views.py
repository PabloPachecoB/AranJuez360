from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from usuarios.permissions import EsCliente, EsEmpresa

from . import services
from .models import Pedido
from .serializers import CrearPedidoSerializer, PedidoSerializer, ValidarRetiroSerializer


def _regla(fn, *args, **kwargs):
    """Traduce errores de dominio a respuestas HTTP (mismo patrón que fidelizacion)."""
    try:
        return fn(*args, **kwargs)
    except services.ReglaNegocioError as exc:
        raise ValidationError({"detail": str(exc)})
    except Pedido.DoesNotExist:
        raise NotFound("Pedido no encontrado.")


# --- Cliente ------------------------------------------------------------------

class MisPedidosViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """El cliente arma su carrito y lo envía como pedido; consulta los suyos."""

    serializer_class = PedidoSerializer
    permission_classes = [EsCliente]

    def get_queryset(self):
        return (
            Pedido.objects.filter(cliente=self.request.user)
            .select_related("empresa")
            .prefetch_related("items__producto")
        )

    def create(self, request):
        entrada = CrearPedidoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        pedido = _regla(
            services.crear_pedido,
            request.user,
            entrada.validated_data["empresa"],
            entrada.validated_data["items"],
        )
        return Response(PedidoSerializer(pedido).data, status=status.HTTP_201_CREATED)


# --- Panel del negocio ----------------------------------------------------------

class MisPedidosEmpresaViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Pedidos entrantes del negocio logueado: cambiar estado, cancelar y
    validar el código de retiro presentado físicamente por el cliente."""

    serializer_class = PedidoSerializer
    permission_classes = [EsEmpresa]

    def get_queryset(self):
        qs = (
            Pedido.objects.filter(empresa=self.request.user.empresa)
            .select_related("cliente")
            .prefetch_related("items__producto")
        )
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado.upper())
        return qs

    @action(detail=True, methods=["post"])
    def avanzar(self, request, pk=None):
        pedido = _regla(services.avanzar_estado, int(pk), request.user.empresa)
        return Response(self.get_serializer(pedido).data)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        pedido = _regla(services.cancelar_pedido, int(pk), request.user.empresa)
        return Response(self.get_serializer(pedido).data)

    @action(detail=False, methods=["post"], url_path="validar-retiro")
    def validar_retiro(self, request):
        entrada = ValidarRetiroSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        pedido = _regla(
            services.validar_retiro, request.user.empresa, entrada.validated_data["codigo_retiro"]
        )
        return Response(self.get_serializer(pedido).data)
