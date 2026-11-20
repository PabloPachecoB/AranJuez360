from django.db.models import Count, Q, Sum
from django.shortcuts import render
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from usuarios.permissions import EsAdmin, EsCliente, EsEmpresa

from . import services
from .models import Pedido
from .serializers import CrearPedidoSerializer, PedidoAdminSerializer, PedidoSerializer, ValidarRetiroSerializer


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
        services.vencer_pagos_pendientes()
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
            entrada.validated_data.get("retiro_programado"),
            entrada.validated_data.get("total_esperado"),
        )
        return Response(PedidoSerializer(pedido).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="simular-pago")
    def simular_pago(self, request, pk=None):
        """Demo: el cliente "paga" el QR desde la misma app (como si su banco confirmara)."""
        pedido = self.get_object()
        return Response(PedidoSerializer(_regla(services.confirmar_pago, pedido.pago_referencia)).data)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        return Response(PedidoSerializer(_regla(services.cancelar_por_cliente, pk, request.user)).data)

    @action(detail=True, methods=["post"])
    def llegue(self, request, pk=None):
        """El cliente avisa que ya está en el Paseo para recoger."""
        return Response(PedidoSerializer(_regla(services.avisar_llegada, pk, request.user)).data)


# --- Panel del negocio ----------------------------------------------------------

class MisPedidosEmpresaViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Pedidos entrantes del negocio logueado: cambiar estado, cancelar y
    validar el código de retiro presentado físicamente por el cliente."""

    serializer_class = PedidoSerializer
    permission_classes = [EsEmpresa]

    def get_queryset(self):
        services.vencer_pagos_pendientes()
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


# --- Administrador del Paseo ------------------------------------------------------

class PedidosAdminViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """El administrador supervisa los pedidos de todos los negocios (solo lectura).

    Filtros: ?estado=LISTO_PARA_RECOGER · ?empresa=<id> · ?buscar=código, cliente o negocio
    """

    serializer_class = PedidoAdminSerializer
    permission_classes = [EsAdmin]

    def get_queryset(self):
        services.vencer_pagos_pendientes()
        qs = Pedido.objects.select_related("cliente", "empresa").prefetch_related("items__producto")
        params = self.request.query_params
        if params.get("estado"):
            qs = qs.filter(estado=params["estado"].upper())
        if params.get("empresa"):
            qs = qs.filter(empresa_id=params["empresa"])
        buscar = (params.get("buscar") or "").strip()
        if buscar:
            qs = qs.filter(
                Q(codigo_retiro__icontains=buscar) | Q(empresa__nombre__icontains=buscar)
                | Q(cliente__first_name__icontains=buscar) | Q(cliente__last_name__icontains=buscar)
                | Q(cliente__email__icontains=buscar)
            )
        return qs

    @action(detail=False, methods=["get"])
    def resumen(self, request):
        """Cuántos pedidos hay en cada estado y cuánto se vendió (solo lo pagado)."""
        services.vencer_pagos_pendientes()
        por_estado = {e: 0 for e in Pedido.Estado.values}
        for fila in Pedido.objects.values("estado").annotate(n=Count("id")):
            por_estado[fila["estado"]] = fila["n"]
        vendido = Pedido.objects.filter(pagado_en__isnull=False).exclude(estado=Pedido.Estado.CANCELADO) \
            .aggregate(t=Sum("total"))["t"] or 0
        return Response({"por_estado": por_estado, "vendido": vendido, "pedidos": sum(por_estado.values())})


# --- Banco simulado (página pública que abre el QR de cobro) ----------------------

def pago_simulado(request, referencia):
    """Simula la app de un banco: muestra el cobro y, al confirmar, avisa el pago al sistema."""
    pedido = Pedido.objects.select_related("empresa").filter(pago_referencia=referencia.upper()).first()
    if pedido is None:
        return render(request, "pedidos/pago_simulado.html", {"error": "Ese QR de cobro no existe."}, status=404)
    error = None
    if request.method == "POST":
        try:
            pedido = services.confirmar_pago(referencia)
        except services.ReglaNegocioError as exc:
            error = str(exc)
        pedido.refresh_from_db()
    return render(request, "pedidos/pago_simulado.html", {"pedido": pedido, "error": error})
