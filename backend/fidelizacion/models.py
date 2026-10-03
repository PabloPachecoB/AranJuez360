from decimal import Decimal
import secrets

from django.conf import settings
from django.db import models


class ConfiguracionPuntos(models.Model):
    """Reglas globales de Paseo Points (una sola fila, la edita el admin)."""

    puntos_por_boliviano = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("1"))
    monto_maximo_solicitud = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("5000"),
        help_text="Montos mayores se rechazan al crear la solicitud.",
    )
    solicitudes_diarias_por_empresa = models.PositiveSmallIntegerField(
        default=3, help_text="Máximo de solicitudes de un cliente en una misma empresa por día.",
    )
    puntos_por_visita = models.PositiveIntegerField(
        default=1, help_text="Puntos que gana el cliente cuando el portero registra su ingreso.",
    )
    visitas_con_puntos_por_dia = models.PositiveSmallIntegerField(
        default=1, help_text="Cuántos ingresos por día suman puntos (los demás solo se registran).",
    )
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "configuración de puntos"
        verbose_name_plural = "configuración de puntos"

    @classmethod
    def actual(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Bs 1 = {self.puntos_por_boliviano} puntos"


class SolicitudPuntos(models.Model):
    """El cliente escanea el QR/NFC de la empresa, ingresa NIT y monto, y la
    solicitud queda pendiente hasta que caja la revise contra el ticket."""

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADA = "APROBADA", "Aprobada"
        RECHAZADA = "RECHAZADA", "Rechazada"

    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="solicitudes_puntos"
    )
    empresa = models.ForeignKey(
        "empresas.Empresa", on_delete=models.PROTECT, related_name="solicitudes_puntos"
    )
    nit = models.CharField(max_length=20)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    puntos = models.PositiveIntegerField(default=0, help_text="Puntos acreditados al aprobar.")
    atendida_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="solicitudes_atendidas",
    )
    atendida_en = models.DateTimeField(null=True, blank=True)
    motivo_rechazo = models.CharField(max_length=200, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        indexes = [models.Index(fields=["empresa", "estado"])]

    def __str__(self):
        return f"{self.cliente} · {self.empresa} · Bs {self.monto} [{self.estado}]"


class Visita(models.Model):
    """Ingreso de un cliente al Paseo registrado por el portero."""

    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="visitas"
    )
    portero = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="visitas_registradas"
    )
    puntos = models.PositiveIntegerField(default=0, help_text="0 si ya superó el cupo diario.")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.cliente} · {self.creado_en:%Y-%m-%d %H:%M}"


class MovimientoPuntos(models.Model):
    class Tipo(models.TextChoices):
        COMPRA = "COMPRA", "Compra"
        VISITA = "VISITA", "Visita"
        CANJE = "CANJE", "Canje"

    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="movimientos_puntos"
    )
    empresa = models.ForeignKey(
        "empresas.Empresa", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="movimientos_puntos",
    )
    solicitud = models.OneToOneField(
        SolicitudPuntos, on_delete=models.SET_NULL, null=True, blank=True, related_name="movimiento"
    )
    visita = models.OneToOneField(
        Visita, on_delete=models.SET_NULL, null=True, blank=True, related_name="movimiento"
    )
    pedido = models.OneToOneField(
        "pedidos.Pedido", on_delete=models.PROTECT, null=True, blank=True,
        related_name="movimiento_puntos",
    )
    puntos = models.IntegerField(help_text="Positivo si gana, negativo si canjea.")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    descripcion = models.CharField(max_length=200, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.cliente} {self.puntos:+d} ({self.tipo})"


class Recompensa(models.Model):
    nombre = models.CharField(max_length=120)
    descripcion = models.TextField(help_text="Beneficio exacto y condiciones de entrega.")
    costo_puntos = models.PositiveIntegerField()
    negocio = models.ForeignKey("empresas.Empresa", on_delete=models.PROTECT,
                                null=True, blank=True, related_name="recompensas")
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["costo_puntos", "id"]
        constraints = [models.CheckConstraint(check=models.Q(costo_puntos__gt=0),
                                              name="recompensa_costo_positivo")]


def nuevo_codigo_cupon():
    return secrets.token_hex(12).upper()


class Cupon(models.Model):
    class Estado(models.TextChoices):
        ACTIVO = "activo", "Activo"
        USADO = "usado", "Usado"
        VENCIDO = "vencido", "Vencido"

    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                related_name="cupones")
    recompensa = models.ForeignKey(Recompensa, on_delete=models.PROTECT, related_name="cupones")
    codigo = models.CharField(max_length=24, unique=True, default=nuevo_codigo_cupon, editable=False)
    # Copia de las condiciones al emitir: editar la recompensa no cambia lo ya adquirido.
    nombre = models.CharField(max_length=120)
    descripcion = models.TextField()
    costo_puntos = models.PositiveIntegerField()
    negocio = models.ForeignKey("empresas.Empresa", on_delete=models.PROTECT,
                                null=True, blank=True, related_name="cupones")
    movimiento = models.OneToOneField(MovimientoPuntos, on_delete=models.PROTECT,
                                      related_name="cupon")
    clave_operacion = models.UUIDField()
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ACTIVO)
    usado_en = models.DateTimeField(null=True, blank=True)
    validado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     null=True, blank=True, related_name="cupones_validados")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en", "-id"]
        constraints = [models.UniqueConstraint(fields=["cliente", "clave_operacion"],
                                               name="cupon_operacion_unica")]
