from django.conf import settings
from rest_framework import serializers

from .models import Pedido, PedidoItem


class ItemCarritoSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)


class CrearPedidoSerializer(serializers.Serializer):
    empresa = serializers.IntegerField()
    items = ItemCarritoSerializer(many=True)
    # Reserva: hora a la que el cliente retira (vacío = lo antes posible).
    retiro_programado = serializers.DateTimeField(required=False, allow_null=True)
    # Total que el cliente vio en el carrito: si no coincide con los precios actuales, no se crea el pedido.
    total_esperado = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)


class PedidoItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = PedidoItem
        fields = ["id", "producto", "producto_nombre", "cantidad", "precio_unitario"]
        read_only_fields = fields


class PedidoSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True)
    cliente_nombre = serializers.SerializerMethodField()
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    items = PedidoItemSerializer(many=True, read_only=True)
    empresa_logo = serializers.ImageField(source="empresa.logo", read_only=True)
    empresa_piso = serializers.CharField(source="empresa.piso", read_only=True)
    empresa_local = serializers.CharField(source="empresa.local", read_only=True)
    pago_qr = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id", "cliente", "cliente_nombre", "empresa", "empresa_nombre", "empresa_logo", "empresa_piso",
            "empresa_local", "total", "estado", "estado_display", "codigo_retiro", "items",
            "pago_referencia", "pago_qr", "pago_vence_en", "pagado_en", "reembolsado_en", "llego_en",
            "retiro_programado",
            "entregado_en", "creado_en",
        ]
        read_only_fields = fields

    def get_pago_qr(self, obj):
        """Contenido del QR de cobro: abre la página del banco simulado."""
        return f"{settings.PUBLIC_BASE_URL}/pago-simulado/{obj.pago_referencia}/"

    def get_cliente_nombre(self, obj):
        return obj.cliente.get_full_name() or obj.cliente.username


class PedidoAdminSerializer(PedidoSerializer):
    """Para el panel del administrador: quién pidió y en qué negocio, con teléfono para contactarlo."""

    cliente_email = serializers.EmailField(source="cliente.email", read_only=True)
    cliente_celular = serializers.CharField(source="cliente.celular", read_only=True, default="")

    class Meta(PedidoSerializer.Meta):
        fields = PedidoSerializer.Meta.fields + ["cliente_email", "cliente_celular"]
        read_only_fields = fields


class ValidarRetiroSerializer(serializers.Serializer):
    codigo_retiro = serializers.CharField(max_length=16)
