"""Acciones que Jarvis puede proponer: cine, recompensas, pedir comida y cupos de eventos.

Flujo seguro: el LLM solo elige la herramienta y sus argumentos. `preparar` valida
con datos reales del backend y arma un resumen; la acción queda PENDIENTE y recién
se ejecuta cuando el usuario toca "Confirmar" en la app (`ejecutar`). El modelo
nunca mueve monedas por sí solo.
"""

from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone

from empresas.models import Producto
from entretenimiento import escenario
from entretenimiento import services as cine
from entretenimiento.models import Evento, ReservaCine, ReservaEvento
from fidelizacion import services as puntos
from fidelizacion.services import ReglaNegocioError
from pedidos import services as pedidos

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


# --- pedir_comida (PaseoYa: se paga con QR y se retira en el local) -------------------

def _hora_retiro(args):
    """"13:30" + "hoy"/"mañana" -> datetime con zona; vacío = lo antes posible."""
    hora = str(args.get("retiro_hora") or "").strip()
    if not hora:
        return None
    try:
        h, m = (int(x) for x in hora.replace(".", ":").split(":")[:2])
    except ValueError:
        raise ReglaNegocioError("¿A qué hora quieres retirarlo? Dímelo como 13:30.")
    dia = timezone.localdate() + timedelta(days=1 if str(args.get("retiro_dia", "")).lower().startswith("ma") else 0)
    return timezone.make_aware(datetime(dia.year, dia.month, dia.day, h, m))


def _items(args):
    items = args.get("items") or []
    if not items and args.get("producto_id"):
        items = [{"producto_id": args["producto_id"], "cantidad": args.get("cantidad") or 1}]
    return [{"producto_id": int(i["producto_id"]), "cantidad": max(1, int(i.get("cantidad") or 1))} for i in items]


def _preparar_pedido(user, args):
    items = _items(args)
    if not items:
        raise ReglaNegocioError("¿Qué plato quieres pedir? Dime el nombre y de qué local.")
    productos = (
        Producto.objects.filter(id__in=[i["producto_id"] for i in items], activo=True)
        .select_related("empresa__categoria").in_bulk()
    )
    if len(productos) != len({i["producto_id"] for i in items}):
        raise ReglaNegocioError("Ese plato no está en el menú ahora. ¿Te muestro qué hay?")
    empresas = {p.empresa for p in productos.values()}
    if len(empresas) > 1:
        raise ReglaNegocioError("Cada pedido es de un solo local. ¿De cuál lo quieres primero?")
    empresa = empresas.pop()
    if not (empresa.categoria and empresa.categoria.nombre == pedidos.RUBRO_COMIDA):
        raise ReglaNegocioError(
            f"Por ahora solo puedo pedir comida. En {empresa.nombre} puedes comprar directamente en el local."
        )
    retiro = _hora_retiro(args)
    if retiro is not None:
        ahora = timezone.now()
        if retiro < ahora + timedelta(minutes=pedidos.MINUTOS_MINIMOS_RESERVA):
            raise ReglaNegocioError(f"Necesitan al menos {pedidos.MINUTOS_MINIMOS_RESERVA} minutos para prepararlo. ¿Otra hora?")
        if retiro > ahora + timedelta(days=pedidos.DIAS_MAXIMOS_RESERVA):
            raise ReglaNegocioError(f"Puedo reservar con hasta {pedidos.DIAS_MAXIMOS_RESERVA} días de anticipación.")
    total = sum(pedidos.precio_vigente(productos[i["producto_id"]]) * i["cantidad"] for i in items)
    detalle = ", ".join(f"{i['cantidad']} {productos[i['producto_id']].nombre}" for i in items)
    cuando = f"para retirar {_cuando(retiro)}" if retiro else "para retirar apenas esté listo"
    ubicacion = f" (piso {empresa.piso})" if empresa.piso else ""
    return (
        f"Pedir {detalle} en {empresa.nombre}{ubicacion} por Bs {_m(total)}, {cuando}. Lo pagas con QR al confirmar",
        {"empresa_id": empresa.id, "items": items, "retiro": retiro.isoformat() if retiro else None},
    )


def _ejecutar_pedido(user, payload):
    retiro = datetime.fromisoformat(payload["retiro"]) if payload.get("retiro") else None
    try:
        pedido = pedidos.crear_pedido(user, payload["empresa_id"], payload["items"], retiro)
    except pedidos.ReglaNegocioError as exc:
        raise ReglaNegocioError(str(exc))
    return (
        f"[excited] ¡Listo! Tu pedido en {pedido.empresa.nombre} te espera. Págalo con el QR que te muestro "
        f"en los próximos {pedidos.MINUTOS_PARA_PAGAR} minutos y luego lo sigues en Comer, Mis pedidos.",
        {"tipo": "pedido", "id": pedido.id},
    )


# --- reservar_cupo_evento (eventos con cupos, entrada con QR) ---------------------------

def _preparar_cupo(user, args):
    evento = Evento.objects.filter(pk=args.get("evento_id"), activo=True).first()
    if evento is None:
        raise ReglaNegocioError("No encontré ese evento.")
    if evento.cupos is None:
        pago = f" La entrada (Bs {_m(evento.precio)}) se paga en el lugar." if evento.precio else ""
        raise ReglaNegocioError(f"{evento.titulo} es de acceso libre: no hace falta reservar, ¡solo ven!{pago}")
    if evento.inicio <= timezone.now():
        raise ReglaNegocioError("Ese evento ya empezó: las reservas están cerradas.")
    if evento.reservas.filter(cliente=user, estado=ReservaEvento.Estado.CONFIRMADA).exists():
        raise ReglaNegocioError("Ya tienes cupo para ese evento: tu entrada está en Diversión, Escenario.")
    cantidad = max(1, int(args.get("cantidad") or 1))
    libres = escenario.disponibles(evento)
    if libres < cantidad:
        raise ReglaNegocioError("Ya no quedan cupos." if not libres else f"Solo quedan {libres} cupos. ¿Reservo esos?")
    precio = f"; la entrada (Bs {_m(evento.precio)}) se paga en el lugar" if evento.precio else ", sin costo"
    return (
        f"Reservar {cantidad} cupo{'s' if cantidad > 1 else ''} para {evento.titulo} {_cuando(evento.inicio)}"
        f"{f' en {evento.lugar}' if evento.lugar else ''}{precio}. Recibes una entrada con QR",
        {"evento_id": evento.id, "cantidad": cantidad},
    )


def _ejecutar_cupo(user, payload):
    reserva = escenario.reservar(user, payload["evento_id"], payload["cantidad"])
    return (
        f"[excited] ¡Tienes tu lugar en {reserva.evento.titulo}! Tu código es {reserva.codigo}; "
        "la entrada con QR quedó en Diversión, Escenario, Mis entradas.",
        {"tipo": "entrada", "id": reserva.id, "codigo": reserva.codigo, "qr": f"paseo360://evento/{reserva.codigo}"},
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
    "pedir_comida": {
        "descripcion": "Pide comida de un restaurante del Paseo para retirar en el local (no hay delivery). "
                       "Úsala cuando el usuario quiera pedir, comprar o encargar un plato o bebida. El usuario lo "
                       "paga con QR en la app después de confirmar.",
        "parametros": {
            "items": {
                "type": "array",
                "description": "platos del MISMO local: [{producto_id, cantidad}] con el [id] del Menú",
                "items": {
                    "type": "object",
                    "properties": {"producto_id": {"type": "integer"}, "cantidad": {"type": "integer"}},
                    "required": ["producto_id", "cantidad"],
                },
            },
            "retiro_hora": {"type": "string", "description": "hora de retiro HH:MM si quiere reservarla; vacío = lo antes posible"},
            "retiro_dia": {"type": "string", "enum": ["hoy", "manana"], "description": "día del retiro reservado"},
        },
        "requeridos": ["items"],
        "preparar": _preparar_pedido,
        "ejecutar": _ejecutar_pedido,
    },
    "reservar_cupo_evento": {
        "descripcion": "Reserva cupos en un evento del Paseo que tiene cupos limitados (conciertos, talleres, "
                       "Escenario abierto). El usuario recibe una entrada con QR. Úsala cuando quiera ir, "
                       "reservar o sacar entrada para un evento.",
        "parametros": {
            "evento_id": {"type": "integer", "description": "id del evento (el número entre [ ] de Eventos)"},
            "cantidad": {"type": "integer", "description": "cuántos cupos (1 a 4)"},
        },
        "requeridos": ["evento_id", "cantidad"],
        "preparar": _preparar_cupo,
        "ejecutar": _ejecutar_cupo,
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
