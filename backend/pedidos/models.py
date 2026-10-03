import secrets

from django.conf import settings
from django.db import models


def _nuevo_codigo_retiro():
    return secrets.token_hex(4).upper()


class Pedido(models.Model):
    """Pedido de PaseoYa: compra online con retiro presencial obligatorio en el
    establecimiento (Reto 3 de la hackathon). Reutiliza Empresa/Producto de la
    app `empresas` en vez de duplicarlos."""

    class Estado(models.TextChoices):
        RECIBIDO = "RECIBIDO", "Recibido"
        CONFIRMADO = "CONFIRMADO", "Confirmado"
        PREPARANDO = "PREPARANDO", "Preparando"
        LISTO_PARA_RECOGER = "LISTO_PARA_RECOGER", "Listo para recoger"
        ENTREGADO = "ENTREGADO", "Entregado"
        CANCELADO = "CANCELADO", "Cancelado"

    cliente = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="pedidos"
    )
    empresa = models.ForeignKey(
        "empresas.Empresa", on_delete=models.PROTECT, related_name="pedidos"
    )
    total = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.RECIBIDO)
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
