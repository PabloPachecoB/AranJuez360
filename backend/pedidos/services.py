"""Lógica de PaseoYa: carrito -> pedido -> pago con QR -> estados -> validar retiro.

Mismo patrón que fidelizacion/services.py: errores de dominio como
ReglaNegocioError (se traducen a 400 en las vistas), operaciones que tocan
más de una fila envueltas en transaction.atomic.
"""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from empresas.models import Empresa, Producto
from usuarios.models import Usuario

from .models import Pedido, PedidoItem


class ReglaNegocioError(Exception):
    """Error de validación de dominio que se devuelve al cliente como 400."""


MINUTOS_PARA_PAGAR = 15
MINUTOS_MINIMOS_RESERVA = 20  # tiempo mínimo para preparar un pedido reservado
DIAS_MAXIMOS_RESERVA = 3
RUBRO_COMIDA = "Comida"  # PaseoYa por ahora solo para los negocios de comida

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
ESTADOS_RETIRABLES = {Pedido.Estado.LISTO_PARA_RECOGER, Pedido.Estado.CLIENTE_LLEGO}


def vencer_pagos_pendientes():
    """Los pedidos que no se pagaron a tiempo se cancelan (el QR del banco ya no sirve)."""
    return Pedido.objects.filter(
        estado=Pedido.Estado.PENDIENTE_PAGO, pago_vence_en__lt=timezone.now()
    ).update(estado=Pedido.Estado.CANCELADO)


def precio_vigente(producto: Producto) -> Decimal:
    """El precio que ve el cliente: el de promoción si el producto está en promoción."""
    if producto.en_promocion and producto.precio_promocion:
        return producto.precio_promocion
    return producto.precio


@transaction.atomic
def crear_pedido(cliente: Usuario, empresa_id: int, items: list[dict], retiro_programado=None) -> Pedido:
    """items: [{"producto_id": int, "cantidad": int}, ...], todos del mismo negocio
    (un pedido = un solo negocio, como define el documento base del equipo).
    retiro_programado: hora de retiro reservada (None = lo antes posible)."""
    if retiro_programado is not None:
        ahora = timezone.now()
        if retiro_programado < ahora + timedelta(minutes=MINUTOS_MINIMOS_RESERVA):
            raise ReglaNegocioError(
                f"Reserva el retiro con al menos {MINUTOS_MINIMOS_RESERVA} minutos para que alcancen a prepararlo."
            )
        if retiro_programado > ahora + timedelta(days=DIAS_MAXIMOS_RESERVA):
            raise ReglaNegocioError(f"Puedes reservar con hasta {DIAS_MAXIMOS_RESERVA} días de anticipación.")
    if not items:
        raise ReglaNegocioError("El pedido no puede estar vacío.")

    try:
        empresa = Empresa.objects.select_related("categoria").get(pk=empresa_id, activo=True)
    except Empresa.DoesNotExist:
        raise ReglaNegocioError("Negocio no encontrado o inactivo.")
    if not (empresa.categoria and empresa.categoria.nombre == RUBRO_COMIDA):
        raise ReglaNegocioError("Por ahora los pedidos con retiro son solo para los negocios de comida.")

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
        precio = precio_vigente(producto)
        total += precio * cantidad
        items_a_crear.append((producto, cantidad, precio))

    pedido = Pedido.objects.create(
        cliente=cliente, empresa=empresa, total=total, retiro_programado=retiro_programado,
        pago_vence_en=timezone.now() + timedelta(minutes=MINUTOS_PARA_PAGAR),
    )
    PedidoItem.objects.bulk_create(
        PedidoItem(pedido=pedido, producto=p, cantidad=c, precio_unitario=precio)
        for p, c, precio in items_a_crear
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
def confirmar_pago(referencia: str) -> Pedido:
    """El banco (simulado) avisa que el QR se pagó: el pedido pasa a la cola del negocio."""
    pedido = Pedido.objects.select_for_update().filter(pago_referencia=(referencia or "").strip().upper()).first()
    if pedido is None:
        raise ReglaNegocioError("No existe un cobro con esa referencia.")
    if pedido.pagado_en:
        return pedido  # pagar dos veces el mismo QR no cobra de nuevo
    if pedido.estado != Pedido.Estado.PENDIENTE_PAGO:
        raise ReglaNegocioError("Este pedido ya no se puede pagar (fue cancelado).")
    if pedido.pago_vence_en and pedido.pago_vence_en < timezone.now():
        pedido.estado = Pedido.Estado.CANCELADO
        pedido.save(update_fields=["estado"])
        raise ReglaNegocioError("El QR venció. Vuelve a hacer el pedido desde la app.")
    pedido.estado = Pedido.Estado.RECIBIDO
    pedido.pagado_en = timezone.now()
    pedido.save(update_fields=["estado", "pagado_en"])
    return pedido


def _pedido_del_cliente(pedido_id, cliente: Usuario) -> Pedido:
    pedido = Pedido.objects.select_for_update().filter(pk=pedido_id, cliente=cliente).first()
    if pedido is None:
        raise Pedido.DoesNotExist
    return pedido


@transaction.atomic
def cancelar_por_cliente(pedido_id, cliente: Usuario) -> Pedido:
    """El cliente puede arrepentirse mientras no haya pagado."""
    pedido = _pedido_del_cliente(pedido_id, cliente)
    if pedido.estado != Pedido.Estado.PENDIENTE_PAGO:
        raise ReglaNegocioError("Solo puedes cancelar un pedido que todavía no pagaste.")
    pedido.estado = Pedido.Estado.CANCELADO
    pedido.save(update_fields=["estado"])
    return pedido


@transaction.atomic
def avisar_llegada(pedido_id, cliente: Usuario) -> Pedido:
    """"Ya estoy en el Paseo": el negocio ve que el cliente llegó a recoger."""
    pedido = _pedido_del_cliente(pedido_id, cliente)
    if pedido.estado == Pedido.Estado.CLIENTE_LLEGO:
        return pedido
    if pedido.estado not in ESTADOS_RETIRABLES:
        raise ReglaNegocioError("Avísanos cuando tu pedido esté listo para recoger.")
    pedido.estado = Pedido.Estado.CLIENTE_LLEGO
    pedido.llego_en = timezone.now()
    pedido.save(update_fields=["estado", "llego_en"])
    return pedido


@transaction.atomic
def avanzar_estado(pedido_id: int, empresa: Empresa) -> Pedido:
    """Recibido -> Confirmado -> Preparando -> Listo para recoger. El último
    paso (Listo para recoger -> Entregado) solo pasa validando el código."""
    pedido = _bloquear_pedido_de_empresa(pedido_id, empresa.id)
    if pedido.estado == Pedido.Estado.PENDIENTE_PAGO:
        raise ReglaNegocioError("El cliente todavía no pagó este pedido.")
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
    if pedido.pagado_en:
        pedido.reembolsado_en = timezone.now()  # devolución simulada al cliente
    pedido.save(update_fields=["estado", "reembolsado_en"])
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
    if pedido.estado not in ESTADOS_RETIRABLES:
        raise ReglaNegocioError(
            f"El pedido {pedido.codigo_retiro} está '{pedido.get_estado_display()}', "
            "todavía no está listo para recoger."
        )
    pedido.estado = Pedido.Estado.ENTREGADO
    pedido.entregado_en = timezone.now()
    pedido.save(update_fields=["estado", "entregado_en"])
    return pedido
