import secrets
from decimal import Decimal

from django.conf import settings
from django.db import models

# Monedas de Paseo: 1000 monedas = Bs 30 (1 moneda = Bs 0,03) por defecto. El cliente nunca ve
# la equivalencia en Bs; solo la ven el admin del Paseo y los negocios (para fijar sus recompensas).
MONEDA_CERO = Decimal("0")


def _nuevo_codigo_escaneo():
    return secrets.token_urlsafe(12)


class ConfiguracionPuntos(models.Model):
    """Reglas globales de Paseo Points (una sola fila, la edita el admin)."""

    puntos_por_boliviano = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("1"),
        help_text="Monedas por Bs de compra; solo se usa si no hay rangos de compra configurados.",
    )
    valor_moneda_bs = models.DecimalField(
        max_digits=6, decimal_places=4, default=Decimal("0.03"),
        help_text="Cuántos Bs vale 1 moneda (no se muestra a los clientes).",
    )
    monto_maximo_solicitud = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("5000"),
        help_text="Montos mayores se rechazan al crear la solicitud.",
    )
    solicitudes_diarias_por_empresa = models.PositiveSmallIntegerField(
        default=3, help_text="Máximo de solicitudes de un cliente en una misma empresa por día.",
    )
    puntos_por_visita = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("20"),
        help_text="Monedas por visita (NFC de la puerta o registro del portero).",
    )
    horas_entre_visitas = models.PositiveSmallIntegerField(
        default=24, help_text="Tras una visita con monedas, no vuelve a sumar hasta que pasen estas horas.",
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
        return f"1 moneda = Bs {self.valor_moneda_bs}"


class RangoCompra(models.Model):
    """Monedas que da una compra según su monto (el admin define los rangos)."""

    monto_minimo = models.DecimalField(max_digits=10, decimal_places=2)
    monto_maximo = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, help_text="Vacío = sin tope.",
    )
    monedas = models.DecimalField(max_digits=10, decimal_places=2)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["monto_minimo"]

    def __str__(self):
        tope = f"Bs {self.monto_maximo}" if self.monto_maximo is not None else "más"
        return f"Bs {self.monto_minimo} – {tope}: {self.monedas} monedas"


class PuntoEscaneo(models.Model):
    """QR/NFC del Paseo que da monedas al escanearlo (puerta principal, juegos, cine…).

    Las compras no van aquí: usan el código propio de cada empresa y pasan por caja.
    """

    class Tipo(models.TextChoices):
        ENTRADA = "ENTRADA", "Entrada al Paseo"
        ACTIVIDAD = "ACTIVIDAD", "Actividad"

    nombre = models.CharField(max_length=120)
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    descripcion = models.CharField(max_length=200, blank=True)
    monedas = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("15"))
    horas_espera = models.PositiveSmallIntegerField(
        default=24, help_text="Horas antes de poder volver a ganar en este punto (Entrada usa la regla de visitas).",
    )
    empresa = models.ForeignKey(
        "empresas.Empresa", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="puntos_escaneo", help_text="Opcional: negocio que opera la actividad.",
    )
    codigo = models.CharField(max_length=32, unique=True, default=_nuevo_codigo_escaneo, editable=False)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["tipo", "nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_display()}, {self.monedas} monedas)"


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
    puntos = models.DecimalField(max_digits=10, decimal_places=2, default=MONEDA_CERO, help_text="Monedas acreditadas al aprobar.")
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
    """Ingreso de un cliente al Paseo: lo registra el portero o el propio cliente con el NFC de la puerta."""

    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="visitas"
    )
    portero = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="visitas_registradas"
    )
    punto = models.ForeignKey(
        PuntoEscaneo, on_delete=models.SET_NULL, null=True, blank=True, related_name="visitas",
        help_text="NFC/QR de la puerta, si la registró el propio cliente.",
    )
    puntos = models.DecimalField(max_digits=10, decimal_places=2, default=MONEDA_CERO, help_text="0 si ya sumó una visita en las últimas horas.")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.cliente} · {self.creado_en:%Y-%m-%d %H:%M}"


class MovimientoPuntos(models.Model):
    class Tipo(models.TextChoices):
        COMPRA = "COMPRA", "Compra"
        VISITA = "VISITA", "Visita"
        ACTIVIDAD = "ACTIVIDAD", "Actividad"
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
    punto = models.ForeignKey(
        PuntoEscaneo, on_delete=models.SET_NULL, null=True, blank=True, related_name="movimientos",
    )
    puntos = models.DecimalField(max_digits=10, decimal_places=2, help_text="Monedas: positivo si gana, negativo si canjea.")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    descripcion = models.CharField(max_length=200, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.cliente} {self.puntos:+} ({self.tipo})"


class Recompensa(models.Model):
    """Beneficio que el cliente puede canjear con sus monedas (lo administra el Paseo)."""

    class Categoria(models.TextChoices):
        PARQUEO = "PARQUEO", "Parqueo"
        CINE = "CINE", "Cine"
        DESCUENTO = "DESCUENTO", "Descuento"
        PRODUCTO = "PRODUCTO", "Producto"
        OTRO = "OTRO", "Otro"

    nombre = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True)
    categoria = models.CharField(max_length=20, choices=Categoria.choices, default=Categoria.OTRO)
    costo_puntos = models.DecimalField(max_digits=10, decimal_places=2, help_text="Costo en monedas.")
    valor_bs = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Valor real del premio en Bs (lo ven el admin y el negocio; nunca el cliente).",
    )
    empresa = models.ForeignKey(
        "empresas.Empresa", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="recompensas", help_text="Vacío si aplica en todo el Paseo.",
    )
    imagen = models.ImageField(upload_to="recompensas/", blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["costo_puntos", "nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.costo_puntos} monedas)"


def _nuevo_codigo_canje():
    # Corto y fácil de dictar en caja: 8 caracteres sin letras confusas.
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alfabeto) for _ in range(8))


class Canje(models.Model):
    """Recompensa canjeada: el cliente muestra el código en el negocio o en el Paseo."""

    class Estado(models.TextChoices):
        ACTIVO = "ACTIVO", "Por usar"
        USADO = "USADO", "Usado"
        ANULADO = "ANULADO", "Anulado"

    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="canjes")
    recompensa = models.ForeignKey(Recompensa, on_delete=models.PROTECT, related_name="canjes")
    monedas = models.DecimalField(max_digits=10, decimal_places=2)
    codigo = models.CharField(max_length=12, unique=True, default=_nuevo_codigo_canje, editable=False)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ACTIVO)
    creado_en = models.DateTimeField(auto_now_add=True)
    usado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.codigo} · {self.recompensa} · {self.cliente}"
