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


FORMATOS_AUDIO = ("m4a", "aac", "mp3", "wav", "webm", "ogg", "amr", "3gp", "caf")
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # ~10 MB: varios minutos de nota de voz


class AgentVozRequestSerializer(serializers.Serializer):
    thread_id = serializers.CharField(required=False, allow_blank=True)
    audio = serializers.FileField()

    def validate_audio(self, audio):
        formato = audio.name.rsplit(".", 1)[-1].lower() if "." in audio.name else ""
        if formato not in FORMATOS_AUDIO:
            raise serializers.ValidationError(
                f"Formato de audio no soportado. Usa: {', '.join(FORMATOS_AUDIO)}."
            )
        if audio.size > MAX_AUDIO_BYTES:
            raise serializers.ValidationError("La nota de voz es demasiado larga.")
        audio.formato = formato
        return audio
