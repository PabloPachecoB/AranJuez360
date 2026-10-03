"""Transacciones Points; los serializers/vistas no escriben saldos directamente."""
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from usuarios.models import Usuario
from .models import ConfiguracionPuntos, Cupon, MovimientoPuntos, Recompensa
from .services import ReglaNegocioError, calcular_puntos


@transaction.atomic
def acreditar_pedido(pedido):
    """Llamar dentro de la transacción que valida el retiro. Un movimiento por pedido."""
    from pedidos.models import Pedido
    pedido = Pedido.objects.select_for_update().get(pk=pedido.pk)
    if pedido.estado != Pedido.Estado.ENTREGADO:
        raise ReglaNegocioError("Los puntos se acreditan al entregar el pedido.")
    cliente = Usuario.objects.select_for_update().get(pk=pedido.cliente_id)
    anterior = MovimientoPuntos.objects.filter(pedido=pedido).first()
    if anterior:
        return anterior
    puntos = calcular_puntos(pedido.total, ConfiguracionPuntos.actual())
    if puntos < 0:
        raise ReglaNegocioError("La regla de puntos no puede ser negativa.")
    movimiento = MovimientoPuntos.objects.create(
        cliente=cliente, empresa_id=pedido.empresa_id, pedido=pedido,
        puntos=puntos, tipo=MovimientoPuntos.Tipo.COMPRA,
        descripcion=f"Retiro de pedido {pedido.codigo_retiro}",
    )
    Usuario.objects.filter(pk=cliente.pk).update(puntos_saldo=F("puntos_saldo") + puntos)
    return movimiento


@transaction.atomic
def emitir_cupon(cliente, recompensa_id, clave_operacion):
    if cliente.rol != Usuario.Rol.CLIENTE or not cliente.is_active:
        raise ReglaNegocioError("Se requiere una cuenta de cliente activa.")
    # Un mismo cliente no puede gastar el saldo simultáneamente en dos canjes.
    cliente = Usuario.objects.select_for_update().get(pk=cliente.pk)
    anterior = Cupon.objects.filter(cliente=cliente, clave_operacion=clave_operacion).first()
    if anterior:
        if anterior.recompensa_id != recompensa_id:
            raise ReglaNegocioError("La clave ya corresponde a otra recompensa.")
        return anterior, False
    recompensa = Recompensa.objects.select_for_update().filter(pk=recompensa_id).first()
    if not recompensa or not recompensa.activo:
        raise ReglaNegocioError("Esta recompensa no está disponible.")
    if recompensa.negocio_id and (not recompensa.negocio.activo or recompensa.negocio.tipo == "OFICINA"):
        raise ReglaNegocioError("El establecimiento no está disponible.")
    # No se activan premios globales antes de definir quién los acepta/financia.
    if not recompensa.negocio_id:
        raise ReglaNegocioError("Esta recompensa necesita un establecimiento responsable.")
    actualizado = Usuario.objects.filter(pk=cliente.pk, puntos_saldo__gte=recompensa.costo_puntos).update(
        puntos_saldo=F("puntos_saldo") - recompensa.costo_puntos
    )
    if not actualizado:
        raise ReglaNegocioError("No tienes suficientes puntos para este beneficio.")
    movimiento = MovimientoPuntos.objects.create(
        cliente=cliente, empresa_id=recompensa.negocio_id,
        puntos=-recompensa.costo_puntos, tipo=MovimientoPuntos.Tipo.CANJE,
        descripcion=f"Cupón: {recompensa.nombre}"[:200],
    )
    cupon = Cupon.objects.create(
        cliente=cliente, recompensa=recompensa, negocio_id=recompensa.negocio_id,
        nombre=recompensa.nombre, descripcion=recompensa.descripcion,
        costo_puntos=recompensa.costo_puntos, movimiento=movimiento,
        clave_operacion=clave_operacion,
    )
    return cupon, True


def _cupon_de_caja(codigo, cajero, bloquear=False):
    if (cajero.rol not in (Usuario.Rol.NEGOCIO, Usuario.Rol.CAJERO)
            or not cajero.empresa_id or not cajero.empresa.activo):
        raise ReglaNegocioError("Se requiere una caja de negocio activa.")
    qs = Cupon.objects.select_for_update() if bloquear else Cupon.objects
    cupon = qs.filter(codigo=codigo.strip().upper(), negocio_id=cajero.empresa_id).first()
    if not cupon:
        raise ReglaNegocioError("Cupón no encontrado para tu establecimiento.")
    return cupon


def consultar_cupon(codigo, cajero):
    return _cupon_de_caja(codigo, cajero)


@transaction.atomic
def validar_cupon(codigo, cajero):
    cupon = _cupon_de_caja(codigo, cajero, bloquear=True)
    if cupon.estado != Cupon.Estado.ACTIVO:
        raise ReglaNegocioError("El cupón ya fue utilizado o no está activo.")
    cupon.estado = Cupon.Estado.USADO
    cupon.usado_en = timezone.now()
    cupon.validado_por = cajero
    cupon.save(update_fields=["estado", "usado_en", "validado_por"])
    # El débito ocurrió al emitir; validar solo registra la entrega del beneficio.
    return cupon
