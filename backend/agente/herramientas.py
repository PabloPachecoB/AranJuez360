"""Acciones que Jarvis puede proponer (reservar cine, canjear recompensas, cancelar).

Flujo seguro: el LLM solo elige la herramienta y sus argumentos. `preparar` valida
con datos reales del backend y arma un resumen; la acción queda PENDIENTE y recién
se ejecuta cuando el usuario toca "Confirmar" en la app (`ejecutar`). El modelo
nunca mueve monedas por sí solo.
"""

from decimal import Decimal

from django.utils import timezone

from entretenimiento import services as cine
from entretenimiento.models import ReservaCine
from fidelizacion import services as puntos
from fidelizacion.services import ReglaNegocioError

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _m(valor) -> str:
    return f"{Decimal(valor):.2f}".rstrip("0").rstrip(".").replace(".", ",")


def _cuando(momento) -> str:
    local = timezone.localtime(momento)
    return f"el {DIAS[local.weekday()]} {local:%d/%m} a las {local:%H:%M}"


# --- reservar_entradas_cine ---------------------------------------------------------

def _preparar_reserva(user, args):
    funcion = cine.funcion_reservable(args.get("funcion_id"))
    cantidad = int(args.get("cantidad") or 1)
    metodo = "MONEDAS" if str(args.get("metodo", "")).upper().startswith("MONEDA") else "BOLETERIA"
    cotizacion = cine.cotizar(funcion, cantidad, metodo)
    detalle = (
        f"{cantidad} entrada{'s' if cantidad > 1 else ''} para {funcion.pelicula.titulo} "
        f"{_cuando(funcion.inicio)}{f', {funcion.sala}' if funcion.sala else ''} ({funcion.get_formato_display()})"
    )
    if metodo == "MONEDAS":
        saldo = type(user).objects.values_list("puntos_saldo", flat=True).get(pk=user.pk)
        if saldo < cotizacion["monedas"]:
            raise ReglaNegocioError(
                f"Con monedas cuesta {_m(cotizacion['monedas'])} y tienes {_m(saldo)}. "
                "Puedo reservarla para que pagues en boletería, ¿te parece?"
            )
        pago = f"pagando {_m(cotizacion['monedas'])} monedas"
    elif cotizacion["total_bs"]:
        pago = f"para pagar Bs {_m(cotizacion['total_bs'])} en boletería"
    else:
        pago = "para pagar en boletería"
    payload = {"funcion_id": funcion.id, "cantidad": cantidad, "metodo": metodo}
    return f"Reservar {detalle}, {pago}", payload


def _ejecutar_reserva(user, payload):
    reserva = cine.reservar(user, payload["funcion_id"], payload["cantidad"], payload["metodo"])
    texto = (
        f"[excited] ¡Listo! Tus entradas para {reserva.funcion.pelicula.titulo} están reservadas. "
        f"Tu código es {reserva.codigo}."
    )
    if reserva.metodo == ReservaCine.Metodo.BOLETERIA:
        texto += " Muéstralo en boletería para pagar y retirar tus entradas."
    return texto, {"tipo": "reserva", "id": reserva.id, "codigo": reserva.codigo}


# --- canjear_recompensa ---------------------------------------------------------------

def _preparar_canje(user, args):
    recompensa = puntos.recompensa_activa(args.get("recompensa_id"))
    saldo = type(user).objects.values_list("puntos_saldo", flat=True).get(pk=user.pk)
    if saldo < recompensa.costo_puntos:
        raise ReglaNegocioError(
            f"Para {recompensa.nombre} necesitas {_m(recompensa.costo_puntos)} monedas y tienes {_m(saldo)}."
        )
    puntos.validar_racha(user, recompensa)  # p. ej. parqueo gratis: 15 días seguidos de visita
    lugar = f" en {recompensa.empresa.nombre}" if recompensa.empresa else ""
    return (
        f"Canjear {recompensa.nombre}{lugar} por {_m(recompensa.costo_puntos)} monedas",
        {"recompensa_id": recompensa.id},
    )


def _ejecutar_canje(user, payload):
    canje = puntos.canjear_recompensa(user, payload["recompensa_id"])
    return (
        f"[excited] ¡Canjeado! {canje.recompensa.nombre} ya es tuyo. Muestra el código {canje.codigo} para usarlo.",
        {"tipo": "canje", "id": canje.id, "codigo": canje.codigo},
    )


# --- cancelar_reserva_cine ------------------------------------------------------------

def _preparar_cancelacion(user, args):
    reserva = (
        ReservaCine.objects.select_related("funcion__pelicula")
        .filter(pk=args.get("reserva_id"), cliente=user, estado=ReservaCine.Estado.CONFIRMADA).first()
    )
    if reserva is None:
        raise ReglaNegocioError("No encontré esa reserva activa.")
    devolucion = f" y te devuelvo {_m(reserva.monedas)} monedas" if reserva.monedas else ""
    return (
        f"Cancelar tu reserva {reserva.codigo} de {reserva.funcion.pelicula.titulo} {_cuando(reserva.funcion.inicio)}{devolucion}",
        {"reserva_id": reserva.id},
    )


def _ejecutar_cancelacion(user, payload):
    reserva = cine.cancelar(user, payload["reserva_id"])
    return (
        f"[warmly] Listo, cancelé tu reserva de {reserva.funcion.pelicula.titulo}.",
        {"tipo": "cancelacion", "id": reserva.id},
    )


HERRAMIENTAS = {
    "reservar_entradas_cine": {
        "descripcion": "Reserva entradas para una función de cine de la cartelera. Úsala cuando el usuario quiera "
                       "ir al cine, comprar o reservar entradas.",
        "parametros": {
            "funcion_id": {"type": "integer", "description": "id de la función (el número entre [ ] de la cartelera)"},
            "cantidad": {"type": "integer", "description": "cuántas entradas (1 a 10)"},
            "metodo": {"type": "string", "enum": ["MONEDAS", "BOLETERIA"],
                       "description": "MONEDAS para pagar con sus monedas; BOLETERIA para pagar en el cine"},
        },
        "requeridos": ["funcion_id", "cantidad", "metodo"],
        "preparar": _preparar_reserva,
        "ejecutar": _ejecutar_reserva,
    },
    "canjear_recompensa": {
        "descripcion": "Canjea una recompensa (parqueo, cine, descuento, producto) con las monedas del usuario.",
        "parametros": {
            "recompensa_id": {"type": "integer", "description": "id de la recompensa (el número entre [ ])"},
        },
        "requeridos": ["recompensa_id"],
        "preparar": _preparar_canje,
        "ejecutar": _ejecutar_canje,
    },
    "cancelar_reserva_cine": {
        "descripcion": "Cancela una reserva de cine activa del usuario (hasta 1 hora antes de la función).",
        "parametros": {
            "reserva_id": {"type": "integer", "description": "id de la reserva (el número entre [ ] de sus reservas)"},
        },
        "requeridos": ["reserva_id"],
        "preparar": _preparar_cancelacion,
        "ejecutar": _ejecutar_cancelacion,
    },
}


def definiciones_openai() -> list:
    """Herramientas en el formato `tools` de la API compatible con OpenAI."""
    return [
        {
            "type": "function",
            "function": {
                "name": nombre,
                "description": h["descripcion"],
                "parameters": {"type": "object", "properties": h["parametros"], "required": h["requeridos"]},
            },
        }
        for nombre, h in HERRAMIENTAS.items()
    ]


def preparar(nombre: str, user, args: dict):
    if nombre not in HERRAMIENTAS:
        raise ReglaNegocioError("No sé hacer esa acción todavía.")
    try:
        return HERRAMIENTAS[nombre]["preparar"](user, args or {})
    except (TypeError, ValueError):
        raise ReglaNegocioError("Me faltan datos para hacer eso. ¿Me lo dices de nuevo?")


def ejecutar(nombre: str, user, payload: dict):
    return HERRAMIENTAS[nombre]["ejecutar"](user, payload)
