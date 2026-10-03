from rest_framework import serializers

from .models import AgentAction


class AgentActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentAction
        fields = [
            "id", "thread_id", "tipo_accion", "payload",
            "estado", "resultado", "fecha_creacion",
        ]
        read_only_fields = fields


class AgentChatRequestSerializer(serializers.Serializer):
    thread_id = serializers.CharField(required=False, allow_blank=True)
    message = serializers.CharField()
