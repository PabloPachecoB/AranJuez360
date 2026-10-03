"""Lógica de PaseoYa: carrito -> pedido -> estados -> validar retiro.

Mismo patrón que fidelizacion/services.py: errores de dominio como
ReglaNegocioError (se traducen a 400 en las vistas), operaciones que tocan
más de una fila envueltas en transaction.atomic.
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from empresas.models import Empresa, Producto
from usuarios.models import Usuario

from .models import Pedido, PedidoItem


class ReglaNegocioError(Exception):
    """Error de validación de dominio que se devuelve al cliente como 400."""


SIGUIENTE_ESTADO = {
    Pedido.Estado.RECIBIDO: Pedido.Estado.CONFIRMADO,
    Pedido.Estado.CONFIRMADO: Pedido.Estado.PREPARANDO,
    Pedido.Estado.PREPARANDO: Pedido.Estado.LISTO_PARA_RECOGER,
}

ESTADOS_CANCELABLES = {
    Pedido.Estado.RECIBIDO,
    Pedido.Estado.CONFIRMADO,
    Pedido.Estado.PREPARANDO,
}


@transaction.atomic
def crear_pedido(cliente: Usuario, empresa_id: int, items: list[dict]) -> Pedido:
    """items: [{"producto_id": int, "cantidad": int}, ...], todos del mismo negocio
    (un pedido = un solo negocio, como define el documento base del equipo)."""
    if not items:
        raise ReglaNegocioError("El pedido no puede estar vacío.")

    try:
        empresa = Empresa.objects.get(pk=empresa_id, activo=True)
    except Empresa.DoesNotExist:
        raise ReglaNegocioError("Negocio no encontrado o inactivo.")

    productos_ids = [item["producto_id"] for item in items]
    productos = Producto.objects.filter(id__in=productos_ids, activo=True).in_bulk()

    total = Decimal("0")
    items_a_crear = []
    for item in items:
        producto = productos.get(item["producto_id"])
        if producto is None:
            raise ReglaNegocioError(f"Producto {item['producto_id']} no disponible.")
        if producto.empresa_id != empresa.id:
            raise ReglaNegocioError("Todos los productos del pedido deben ser del mismo negocio.")
        cantidad = item["cantidad"]
        if cantidad <= 0:
            raise ReglaNegocioError("La cantidad debe ser mayor a 0.")
        total += producto.precio * cantidad
        items_a_crear.append((producto, cantidad))

    pedido = Pedido.objects.create(cliente=cliente, empresa=empresa, total=total)
    PedidoItem.objects.bulk_create(
        PedidoItem(pedido=pedido, producto=p, cantidad=c, precio_unitario=p.precio)
        for p, c in items_a_crear
    )
    return pedido


def _bloquear_pedido_de_empresa(pedido_id: int, empresa_id: int) -> Pedido:
    pedido = (
        Pedido.objects.select_for_update()
        .filter(pk=pedido_id, empresa_id=empresa_id)
        .first()
    )
    if pedido is None:
        raise Pedido.DoesNotExist
    return pedido


@transaction.atomic
def avanzar_estado(pedido_id: int, empresa: Empresa) -> Pedido:
    """Recibido -> Confirmado -> Preparando -> Listo para recoger. El último
    paso (Listo para recoger -> Entregado) solo pasa validando el código."""
    pedido = _bloquear_pedido_de_empresa(pedido_id, empresa.id)
    siguiente = SIGUIENTE_ESTADO.get(pedido.estado)
    if siguiente is None:
        raise ReglaNegocioError(
            f"El pedido ya está '{pedido.get_estado_display()}' y no se puede avanzar así."
        )
    pedido.estado = siguiente
    pedido.save(update_fields=["estado"])
    return pedido


@transaction.atomic
def cancelar_pedido(pedido_id: int, empresa: Empresa) -> Pedido:
    pedido = _bloquear_pedido_de_empresa(pedido_id, empresa.id)
    if pedido.estado not in ESTADOS_CANCELABLES:
        raise ReglaNegocioError("Este pedido ya no se puede cancelar.")
    pedido.estado = Pedido.Estado.CANCELADO
    pedido.save(update_fields=["estado"])
    return pedido


@transaction.atomic
def validar_retiro(empresa: Empresa, codigo_retiro: str) -> Pedido:
    """El cliente presenta el código físicamente; el negocio lo valida antes de
    entregar (condición central del Reto 3: retiro presencial obligatorio)."""
    codigo = codigo_retiro.strip().upper()
    pedido = (
        Pedido.objects.select_for_update()
        .filter(codigo_retiro=codigo, empresa_id=empresa.id)
        .first()
    )
    if pedido is None:
        raise ReglaNegocioError("No se encontró ningún pedido con ese código en tu negocio.")
    if pedido.estado != Pedido.Estado.LISTO_PARA_RECOGER:
        raise ReglaNegocioError(
            f"El pedido {pedido.codigo_retiro} está '{pedido.get_estado_display()}', "
            "todavía no está listo para recoger."
        )
    pedido.estado = Pedido.Estado.ENTREGADO
    pedido.entregado_en = timezone.now()
    pedido.save(update_fields=["estado", "entregado_en"])
    return pedido
