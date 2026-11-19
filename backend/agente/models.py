import uuid

from django.conf import settings
from django.db import models


class ConversacionJarvis(models.Model):
    """Una conversación de Jarvis que pertenece a un único usuario.

    El UUID es el identificador público que la app usará para consultar o
    continuar una conversación. La pertenencia se verifica siempre mediante
    ``usuario``; nunca se debe confiar solamente en el UUID recibido.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Identificador opaco de uso exclusivo del checkpointer de LangGraph.
    # ``id`` sigue siendo el UUID público de la conversación.
    thread_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversaciones_jarvis",
    )
    titulo = models.CharField(max_length=120, blank=True)
    creada_en = models.DateTimeField(auto_now_add=True)
    actualizada_en = models.DateTimeField(auto_now=True)
    archivada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-actualizada_en"]
        indexes = [
            models.Index(
                fields=["usuario", "archivada_en", "-actualizada_en"],
                name="ag_conv_user_arch_upd_idx",
            )
        ]

    def __str__(self):
        return self.titulo or f"Conversación de {self.usuario} ({self.id})"


class MensajeJarvis(models.Model):
    """Un turno del usuario o de Jarvis dentro de una conversación."""

    class Rol(models.TextChoices):
        USUARIO = "USUARIO", "Usuario"
        ASISTENTE = "ASISTENTE", "Jarvis"

    class Origen(models.TextChoices):
        TEXTO = "TEXTO", "Texto"
        VOZ = "VOZ", "Nota de voz transcrita"

    conversacion = models.ForeignKey(
        ConversacionJarvis,
        on_delete=models.CASCADE,
        related_name="mensajes",
    )
    rol = models.CharField(max_length=12, choices=Rol.choices)
    contenido = models.TextField()
    origen = models.CharField(max_length=10, choices=Origen.choices, default=Origen.TEXTO)
    metadatos = models.JSONField(default=dict, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["creado_en", "id"]
        indexes = [
            models.Index(
                fields=["conversacion", "creado_en"],
                name="ag_msg_conv_created_idx",
            )
        ]

    def __str__(self):
        return f"{self.get_rol_display()}: {self.contenido[:60]}"


class AgentAction(models.Model):
    """Acción propuesta por el agente que el usuario debe confirmar/rechazar.

    Patrón portado de TorreSegura: el grafo propone, el usuario confirma desde
    la app (reautenticando si la acción es sensible) y recién entonces se
    ejecuta y verifica contra el backend.
    """

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        RECHAZADA = "RECHAZADA", "Rechazada"
        EJECUTADA = "EJECUTADA", "Ejecutada"

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="acciones_agente"
    )
    conversacion = models.ForeignKey(
        ConversacionJarvis,
        on_delete=models.SET_NULL,
        related_name="acciones_agente",
        null=True,
        blank=True,
    )
    thread_id = models.CharField(max_length=100, blank=True)
    tipo_accion = models.CharField(max_length=80)
    payload = models.JSONField(default=dict, blank=True)
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PENDIENTE
    )
    resultado = models.JSONField(null=True, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"{self.tipo_accion} [{self.estado}] de {self.usuario}"
