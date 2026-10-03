from rest_framework import serializers

from .models import Pedido, PedidoItem


class ItemCarritoSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)


class CrearPedidoSerializer(serializers.Serializer):
    empresa = serializers.IntegerField()
    items = ItemCarritoSerializer(many=True)


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

    class Meta:
        model = Pedido
        fields = [
            "id", "cliente", "cliente_nombre", "empresa", "empresa_nombre",
            "total", "estado", "estado_display", "codigo_retiro", "items",
            "entregado_en", "creado_en",
        ]
        read_only_fields = fields

    def get_cliente_nombre(self, obj):
        return obj.cliente.get_full_name() or obj.cliente.username


class ValidarRetiroSerializer(serializers.Serializer):
    codigo_retiro = serializers.CharField(max_length=16)
