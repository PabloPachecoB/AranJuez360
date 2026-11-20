"""Reservas de entradas de cine: con monedas (se cobran al reservar) o para pagar en boletería."""

from datetime import timedelta
from decimal import ROUND_UP, Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from fidelizacion.models import ConfiguracionPuntos
from fidelizacion.services import ReglaNegocioError, cobrar_monedas, devolver_monedas
from usuarios.models import Usuario

from .models import Funcion, ReservaCine

MAX_ENTRADAS = 10
CANCELAR_HASTA_MIN = 60  # se puede cancelar hasta 1 hora antes de la función


def disponibles(funcion: Funcion) -> int:
    ocupadas = (
        funcion.reservas.filter(estado=ReservaCine.Estado.CONFIRMADA).aggregate(t=Sum("cantidad"))["t"] or 0
    )
    return max(0, funcion.capacidad - ocupadas)


def funcion_reservable(funcion_id) -> Funcion:
    funcion = (
        Funcion.objects.filter(pk=funcion_id, pelicula__activo=True).select_related("pelicula").first()
    )
    if funcion is None:
        raise ReglaNegocioError("Esa función no existe.")
    if funcion.inicio <= timezone.now():
        raise ReglaNegocioError("Esa función ya empezó. Elige otro horario.")
    return funcion


def cotizar(funcion: Funcion, cantidad: int, metodo: str) -> dict:
    """Valida y calcula lo que costaría la reserva (sin guardar nada)."""
    if not 1 <= int(cantidad) <= MAX_ENTRADAS:
        raise ReglaNegocioError(f"Puedes reservar de 1 a {MAX_ENTRADAS} entradas.")
    if metodo not in ReservaCine.Metodo.values:
        raise ReglaNegocioError("Elige pagar con monedas o en boletería.")
    libres = disponibles(funcion)
    if libres < int(cantidad):
        raise ReglaNegocioError(f"Solo quedan {libres} butacas para esa función.")
    precio = funcion.precio or Decimal("0")
    total = precio * int(cantidad)
    monedas = Decimal("0")
    if metodo == ReservaCine.Metodo.MONEDAS:
        if not total:
            raise ReglaNegocioError("Esta función no tiene precio cargado; resérvala para pagar en boletería.")
        valor = ConfiguracionPuntos.actual().valor_moneda_bs
        monedas = (total / valor).quantize(Decimal("0.01"), rounding=ROUND_UP)
    return {"total_bs": total, "monedas": monedas, "disponibles": libres}


@transaction.atomic
def reservar(cliente: Usuario, funcion_id, cantidad: int, metodo: str) -> ReservaCine:
    funcion = funcion_reservable(funcion_id)
    # Bloquea la función para que dos reservas simultáneas no superen la capacidad.
    Funcion.objects.select_for_update().filter(pk=funcion.pk).first()
    Usuario.objects.select_for_update().filter(pk=cliente.pk).first()
    cotizacion = cotizar(funcion, cantidad, metodo)
    if cotizacion["monedas"]:
        cobrar_monedas(
            cliente.pk, cotizacion["monedas"],
            f"Entradas: {funcion.pelicula.titulo} ({int(cantidad)})", empresa=funcion.pelicula.cine,
        )
    return ReservaCine.objects.create(
        cliente=cliente, funcion=funcion, cantidad=int(cantidad), metodo=metodo,
        total_bs=cotizacion["total_bs"], monedas=cotizacion["monedas"],
    )


@transaction.atomic
def cancelar(cliente: Usuario, reserva_id) -> ReservaCine:
    reserva = (
        ReservaCine.objects.select_for_update().select_related("funcion__pelicula")
        .filter(pk=reserva_id, cliente=cliente).first()
    )
    if reserva is None:
        raise ReglaNegocioError("No encontramos esa reserva.")
    if reserva.estado != ReservaCine.Estado.CONFIRMADA:
        raise ReglaNegocioError("Esa reserva ya estaba cancelada.")
    if reserva.funcion.inicio - timezone.now() < timedelta(minutes=CANCELAR_HASTA_MIN):
        raise ReglaNegocioError("Solo puedes cancelar hasta una hora antes de la función.")
    reserva.estado = ReservaCine.Estado.CANCELADA
    reserva.save(update_fields=["estado"])
    if reserva.monedas:
        devolver_monedas(cliente.pk, reserva.monedas, f"Devolución: {reserva.funcion.pelicula.titulo}")
    return reserva
