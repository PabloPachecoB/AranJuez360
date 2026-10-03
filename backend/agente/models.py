from django.conf import settings
from django.db import models


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
