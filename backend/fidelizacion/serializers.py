from rest_framework import serializers

from .models import ConfiguracionPuntos, MovimientoPuntos, SolicitudPuntos, Visita


class EmpresaEscaneadaSerializer(serializers.Serializer):
    """Lo que ve el cliente al escanear el QR/NFC: nombre y logo."""

    id = serializers.IntegerField()
    nombre = serializers.CharField()
    logo = serializers.ImageField()
    piso = serializers.CharField()
    local = serializers.CharField()


class CrearSolicitudSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=32)
    nit = serializers.RegexField(r"^\d{4,20}$", error_messages={"invalid": "El NIT debe tener solo dígitos."})
    monto = serializers.DecimalField(max_digits=10, decimal_places=2)


class SolicitudSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True)
    empresa_logo = serializers.ImageField(source="empresa.logo", read_only=True)
    cliente_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudPuntos
        fields = [
            "id", "empresa", "empresa_nombre", "empresa_logo", "cliente_nombre",
            "nit", "monto", "estado", "puntos", "motivo_rechazo", "creado_en", "atendida_en",
        ]
        read_only_fields = fields

    def get_cliente_nombre(self, obj):
        return obj.cliente.get_full_name() or obj.cliente.username


class RechazoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=200, required=False, allow_blank=True)


class MovimientoSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True, default=None)

    class Meta:
        model = MovimientoPuntos
        fields = ["id", "empresa", "empresa_nombre", "puntos", "tipo", "descripcion", "creado_en"]
        read_only_fields = fields


class ConfiguracionPuntosSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionPuntos
        fields = [
            "puntos_por_boliviano", "monto_maximo_solicitud",
            "solicitudes_diarias_por_empresa", "puntos_por_visita",
            "visitas_con_puntos_por_dia", "actualizado_en",
        ]
        read_only_fields = ["actualizado_en"]


class RegistrarVisitaSerializer(serializers.Serializer):
    token = serializers.CharField()


class VisitaSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    portero_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Visita
        fields = ["id", "cliente", "cliente_nombre", "portero_nombre", "puntos", "creado_en"]
        read_only_fields = fields

    def get_cliente_nombre(self, obj):
        return obj.cliente.get_full_name() or obj.cliente.username

    def get_portero_nombre(self, obj):
        return obj.portero and (obj.portero.get_full_name() or obj.portero.username)
