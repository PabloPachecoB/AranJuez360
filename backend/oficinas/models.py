"""Visitas a las oficinas que funcionan dentro del Paseo.

Los visitantes no son trabajadores: son clientes de cada oficina. Pueden pedir la
visita desde la app (la oficina la aprueba) o la oficina los invita. En la entrada,
el portero escanea el QR de la invitación y registra el ingreso.
"""

import secrets

from django.conf import settings
from django.db import models


def _nuevo_codigo():
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alfabeto) for _ in range(8))


class Invitacion(models.Model):
    class Origen(models.TextChoices):
        SOLICITUD = "SOLICITUD", "Solicitada por el visitante"
        INVITACION = "INVITACION", "Invitación de la oficina"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADA = "APROBADA", "Aprobada"
        RECHAZADA = "RECHAZADA", "Rechazada"
        CANCELADA = "CANCELADA", "Cancelada"
        USADA = "USADA", "Ingresó"

    oficina = models.ForeignKey(
        "empresas.Empresa", on_delete=models.CASCADE, related_name="invitaciones",
        limit_choices_to={"tipo": "OFICINA"},
    )
    # Visitante con la app (si no tiene, se usan los datos de abajo y el QR va por WhatsApp).
    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="visitas_oficina",
    )
    visitante_nombre = models.CharField(max_length=120)
    visitante_ci = models.CharField(max_length=20, blank=True)
    visitante_celular = models.CharField(max_length=20, blank=True)
    fecha = models.DateField()
    hora = models.TimeField(null=True, blank=True)
    motivo = models.CharField(max_length=200, blank=True)
    origen = models.CharField(max_length=12, choices=Origen.choices)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    motivo_rechazo = models.CharField(max_length=200, blank=True)
    codigo = models.CharField(max_length=12, unique=True, default=_nuevo_codigo, editable=False)
    creado_en = models.DateTimeField(auto_now_add=True)
    respondida_en = models.DateTimeField(null=True, blank=True)
    ingreso_en = models.DateTimeField(null=True, blank=True)
    portero = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ingresos_oficina",
    )

    class Meta:
        ordering = ["-fecha", "-hora", "-creado_en"]
        indexes = [models.Index(fields=["oficina", "estado"]), models.Index(fields=["fecha", "estado"])]

    def __str__(self):
        return f"{self.visitante_nombre} → {self.oficina} ({self.fecha}) [{self.estado}]"
