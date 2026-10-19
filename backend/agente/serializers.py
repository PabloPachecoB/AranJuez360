from rest_framework import serializers

from .models import AgentAction, ConversacionJarvis, MensajeJarvis


class ConversacionJarvisListSerializer(serializers.ModelSerializer):
    """Resumen de una conversación para el historial del usuario."""

    class Meta:
        model = ConversacionJarvis
        fields = ("id", "titulo", "creada_en", "actualizada_en")
        read_only_fields = fields


class ConversacionJarvisDetailSerializer(ConversacionJarvisListSerializer):
    """Detalle público de una conversación; no expone su propietario."""


class ConversacionJarvisCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversacionJarvis
        fields = ("titulo",)


class MensajeJarvisSerializer(serializers.ModelSerializer):
    """Representación de solo lectura de un turno de conversación."""

    productos = serializers.SerializerMethodField()
    empresas = serializers.SerializerMethodField()

    @staticmethod
    def _tarjetas(mensaje, campo, permitidos):
        tarjetas = (mensaje.metadatos or {}).get(campo, [])
        if not isinstance(tarjetas, list):
            return []
        return [
            {clave: tarjeta.get(clave) for clave in permitidos}
            for tarjeta in tarjetas
            if isinstance(tarjeta, dict)
        ]

    def get_productos(self, mensaje):
        return self._tarjetas(
            mensaje,
            "productos",
            ("id", "nombre", "precio", "empresa_id", "empresa_nombre", "piso", "foto"),
        )

    def get_empresas(self, mensaje):
        return self._tarjetas(
            mensaje,
            "empresas",
            ("id", "nombre", "logo", "piso", "categoria_nombre"),
        )

    class Meta:
        model = MensajeJarvis
        fields = ("id", "rol", "contenido", "origen", "creado_en", "productos", "empresas")
        read_only_fields = fields


class AgentActionSerializer(serializers.ModelSerializer):
    conversation_id = serializers.UUIDField(source="conversacion_id", read_only=True)

    class Meta:
        model = AgentAction
        fields = [
            "id", "conversation_id", "tipo_accion", "payload",
            "estado", "resultado", "fecha_creacion",
        ]
        read_only_fields = fields


class AgentChatRequestSerializer(serializers.Serializer):
    conversation_id = serializers.UUIDField(required=False)
    # Se declara únicamente para rechazar explícitamente contratos antiguos;
    # nunca llega al servicio ni decide el hilo interno.
    thread_id = serializers.CharField(required=False, write_only=True)
    message = serializers.CharField()

    def validate_thread_id(self, value):
        raise serializers.ValidationError(
            "thread_id es interno del servidor. Usa conversation_id para continuar una conversación."
        )


FORMATOS_AUDIO = ("m4a", "aac", "mp3", "wav", "webm", "ogg", "amr", "3gp", "caf")
MAX_AUDIO_BYTES = 10 * 1024 * 1024  # ~10 MB: varios minutos de nota de voz


class AgentVozRequestSerializer(serializers.Serializer):
    conversation_id = serializers.UUIDField(required=False)
    # Se declara solo para rechazar contratos antiguos: el thread pertenece al
    # backend y nunca controla el flujo de voz.
    thread_id = serializers.CharField(required=False, write_only=True)
    audio = serializers.FileField()

    def validate_thread_id(self, value):
        raise serializers.ValidationError(
            "thread_id es interno del servidor. Usa conversation_id para continuar una conversación."
        )

    def validate(self, attrs):
        prohibidos = {"rol", "origen", "metadatos", "usuario", "usuario_id"}
        recibidos = prohibidos.intersection(self.initial_data)
        if recibidos:
            raise serializers.ValidationError(
                {campo: "Este campo es administrado exclusivamente por el servidor." for campo in recibidos}
            )
        return attrs

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
