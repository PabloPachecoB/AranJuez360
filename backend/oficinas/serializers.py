from rest_framework import serializers

from . import services
from .models import Invitacion


class InvitacionSerializer(serializers.ModelSerializer):
    oficina_nombre = serializers.CharField(source="oficina.nombre", read_only=True)
    oficina_piso = serializers.CharField(source="oficina.piso", read_only=True)
    oficina_local = serializers.CharField(source="oficina.local", read_only=True)
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    origen_nombre = serializers.CharField(source="get_origen_display", read_only=True)
    qr = serializers.SerializerMethodField()
    tiene_app = serializers.SerializerMethodField()

    class Meta:
        model = Invitacion
        fields = [
            "id", "oficina", "oficina_nombre", "oficina_piso", "oficina_local", "visitante_nombre",
            "visitante_ci", "visitante_celular", "fecha", "hora", "motivo", "origen", "origen_nombre",
            "estado", "estado_nombre", "motivo_rechazo", "codigo", "qr", "tiene_app", "creado_en",
            "respondida_en", "ingreso_en",
        ]
        read_only_fields = fields

    def get_qr(self, obj):
        # El QR solo existe cuando la visita está aprobada.
        return services.qr_contenido(obj) if obj.estado == Invitacion.Estado.APROBADA else None

    def get_tiene_app(self, obj):
        return obj.cliente_id is not None


class InvitacionOficinaSerializer(InvitacionSerializer):
    """Para la oficina: incluye el enlace público y el de WhatsApp del invitado."""

    enlace = serializers.SerializerMethodField()
    whatsapp = serializers.SerializerMethodField()

    class Meta(InvitacionSerializer.Meta):
        fields = InvitacionSerializer.Meta.fields + ["enlace", "whatsapp"]
        read_only_fields = fields

    def get_enlace(self, obj):
        return services.enlace_publico(obj) if obj.estado == Invitacion.Estado.APROBADA else None

    def get_whatsapp(self, obj):
        return services.whatsapp_url(obj) if obj.estado == Invitacion.Estado.APROBADA else None


class SolicitarSerializer(serializers.Serializer):
    oficina = serializers.IntegerField()
    fecha = serializers.DateField()
    hora = serializers.TimeField(required=False, allow_null=True)
    motivo = serializers.CharField(max_length=200, required=False, allow_blank=True)


class InvitarSerializer(serializers.Serializer):
    cliente = serializers.CharField(required=False, allow_blank=True, help_text="Correo o CI del cliente con app.")
    visitante_nombre = serializers.CharField(max_length=120, required=False, allow_blank=True)
    visitante_ci = serializers.CharField(max_length=20, required=False, allow_blank=True)
    visitante_celular = serializers.CharField(max_length=20, required=False, allow_blank=True)
    fecha = serializers.DateField()
    hora = serializers.TimeField(required=False, allow_null=True)
    motivo = serializers.CharField(max_length=200, required=False, allow_blank=True)


class RechazoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=200, required=False, allow_blank=True)
