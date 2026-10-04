import secrets

from django.conf import settings
from django.db import models


def _nuevo_codigo_retiro():
    return secrets.token_hex(4).upper()


def _nueva_referencia_pago():
    return f"PY{secrets.token_hex(5).upper()}"


class Pedido(models.Model):
    """Pedido de PaseoYa: compra online con retiro presencial obligatorio en el
    establecimiento (Reto 3 de la hackathon). Reutiliza Empresa/Producto de la
    app `empresas` en vez de duplicarlos."""

    class Estado(models.TextChoices):
        PENDIENTE_PAGO = "PENDIENTE_PAGO", "Esperando pago"
        RECIBIDO = "RECIBIDO", "Pagado · recibido"
        CONFIRMADO = "CONFIRMADO", "Confirmado"
        PREPARANDO = "PREPARANDO", "Preparando"
        LISTO_PARA_RECOGER = "LISTO_PARA_RECOGER", "Listo para recoger"
        CLIENTE_LLEGO = "CLIENTE_LLEGO", "Cliente en el Paseo"
        ENTREGADO = "ENTREGADO", "Entregado"
        CANCELADO = "CANCELADO", "Cancelado"

    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="pedidos"
    )
    empresa = models.ForeignKey(
        "empresas.Empresa", on_delete=models.PROTECT, related_name="pedidos"
    )
    total = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE_PAGO)
    # Pago con QR (simulación de un banco): el QR lleva a /pago-simulado/<referencia>/.
    pago_referencia = models.CharField(max_length=16, unique=True, default=_nueva_referencia_pago, editable=False)
    pago_vence_en = models.DateTimeField(null=True, blank=True)
    pagado_en = models.DateTimeField(null=True, blank=True)
    reembolsado_en = models.DateTimeField(null=True, blank=True, help_text="Si el negocio cancela un pedido pagado.")
    llego_en = models.DateTimeField(null=True, blank=True, help_text="Cuando el cliente avisa que está en el Paseo.")
    # Reserva: el cliente compra ahora y elige a qué hora retira (vacío = lo antes posible).
    retiro_programado = models.DateTimeField(null=True, blank=True)
    # Se presenta físicamente al retirar; el negocio lo valida antes de entregar.
    codigo_retiro = models.CharField(
        max_length=16, unique=True, default=_nuevo_codigo_retiro, editable=False
    )
    entregado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        indexes = [models.Index(fields=["empresa", "estado"])]

    def __str__(self):
        return f"{self.codigo_retiro} · {self.cliente} · {self.empresa} [{self.estado}]"


class PedidoItem(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey(
        "empresas.Producto", on_delete=models.PROTECT, related_name="items_pedido"
    )
    cantidad = models.PositiveIntegerField()
    # Copiado del producto al crear el pedido: el precio no debe cambiar si el
    # negocio edita el producto después.
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.cantidad}x {self.producto} ({self.pedido.codigo_retiro})"
