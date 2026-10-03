"""Contexto del Paseo que Jarvis recibe en cada turno.

Se arma en el backend con datos reales (nunca lo inventa el LLM): quién es el
usuario autenticado, sus puntos, las tiendas, ofertas vigentes y recompensas.
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from empresas.models import Empresa, Oferta
from entretenimiento.models import Evento, Funcion, ReservaCine
from fidelizacion.models import Canje, ConfiguracionPuntos, PuntoEscaneo, RangoCompra, Recompensa

from .voz import EMOCIONES

MAX_TIENDAS = 40
MAX_OFERTAS = 20
MAX_RECOMPENSAS = 15
MAX_FUNCIONES = 40
MAX_EVENTOS = 10


def _monedas(valor) -> str:
    """0.75 -> "0,75"; 300.00 -> "300" (así lo lee bien la voz)."""
    texto = f"{valor:.2f}".rstrip("0").rstrip(".")
    return texto.replace(".", ",")


DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _cuando(momento) -> str:
    local = timezone.localtime(momento)
    return f"{DIAS[local.weekday()]} {local:%d/%m %H:%M}"


def _ubicacion(empresa) -> str:
    partes = [f"piso {empresa.piso}" if empresa.piso else "", f"local {empresa.local}" if empresa.local else ""]
    return ", ".join(p for p in partes if p) or "ubicación sin registrar"


def construir_contexto(user) -> dict:
    """Datos del usuario y del Paseo, serializables para el estado del grafo."""
    hoy = timezone.localdate()
    tiendas = (
        Empresa.objects.filter(activo=True)
        .exclude(tipo=Empresa.Tipo.OFICINA)
        .select_related("categoria")
        .order_by("nombre")[:MAX_TIENDAS]
    )
    ofertas = (
        Oferta.objects.filter(activo=True, empresa__activo=True, inicio__lte=hoy, fin__gte=hoy)
        .select_related("empresa")
        .order_by("fin")[:MAX_OFERTAS]
    )
    recompensas = Recompensa.objects.filter(activo=True).select_related("empresa")[:MAX_RECOMPENSAS]
    config = ConfiguracionPuntos.actual()
    ahora = timezone.now()
    funciones = (
        Funcion.objects.filter(pelicula__activo=True, inicio__gte=ahora, inicio__lte=ahora + timedelta(days=3))
        .select_related("pelicula").order_by("inicio")[:MAX_FUNCIONES]
    )
    eventos = (
        Evento.objects.filter(activo=True).filter(Q(inicio__gte=ahora) | Q(fin__gte=ahora))
        .order_by("inicio")[:MAX_EVENTOS]
    )

    return {
        "nombre": user.first_name or user.username,
        "rol": user.get_rol_display(),
        "puntos": _monedas(user.puntos_saldo),
        "valor_moneda": _monedas(config.valor_moneda_bs),
        "saldo_bs": _monedas(user.puntos_saldo * config.valor_moneda_bs),
        "visita": _monedas(config.puntos_por_visita),
        "horas_visita": config.horas_entre_visitas,
        "actividades": [
            f"{p.nombre}: {_monedas(p.monedas)} monedas (una vez cada {p.horas_espera} h)"
            for p in PuntoEscaneo.objects.filter(activo=True, tipo=PuntoEscaneo.Tipo.ACTIVIDAD)
        ],
        "cartelera": [
            f"[{f.id}] {_cuando(f.inicio)} · {f.pelicula.titulo} ({f.pelicula.genero}, "
            f"{f.pelicula.clasificacion}, {f.get_formato_display()} {f.get_idioma_display().lower()}"
            + (f", Bs {_monedas(f.precio)}" if f.precio else "") + ")"
            for f in funciones
        ],
        "eventos": [
            f"{e.titulo} ({e.get_categoria_display()}): {_cuando(e.inicio)}"
            + (f" en {e.lugar}" if e.lugar else "") + (f", Bs {_monedas(e.precio)}" if e.precio else ", entrada libre")
            for e in eventos
        ],
        "mis_reservas": [
            f"[{r.id}] código {r.codigo}: {r.cantidad} × {r.funcion.pelicula.titulo} {_cuando(r.funcion.inicio)}"
            f" ({r.get_metodo_display().lower()})"
            for r in ReservaCine.objects.filter(
                cliente=user, estado=ReservaCine.Estado.CONFIRMADA, funcion__inicio__gte=ahora
            ).select_related("funcion__pelicula")[:10]
        ],
        "mis_cupones": [
            f"código {c.codigo}: {c.recompensa.nombre}"
            for c in Canje.objects.filter(cliente=user, estado=Canje.Estado.ACTIVO).select_related("recompensa")[:10]
        ],
        "rangos_compra": [
            f"compras de Bs {_monedas(r.monto_minimo)}"
            + (f" a Bs {_monedas(r.monto_maximo)}" if r.monto_maximo is not None else " o más")
            + f": {_monedas(r.monedas)} monedas"
            for r in RangoCompra.objects.filter(activo=True)
        ],
        "fecha": f"{DIAS[hoy.weekday()]} {hoy.isoformat()}",
        "tiendas": [
            f"{t.nombre} ({t.categoria.nombre if t.categoria else t.get_tipo_display()}, {_ubicacion(t)})"
            for t in tiendas
        ],
        "ofertas": [
            f"{o.titulo} en {o.empresa.nombre}"
            + (f" a Bs {o.precio_oferta}" if o.precio_oferta is not None else "")
            + f" (hasta {o.fin.isoformat()})"
            for o in ofertas
        ],
        "recompensas": [
            f"[{r.id}] {r.nombre} ({r.get_categoria_display().lower()}): {_monedas(r.costo_puntos)} monedas"
            + (f" en {r.empresa.nombre}" if r.empresa else "")
            for r in recompensas
        ],
    }


def _lista(items) -> str:
    return "\n".join(f"- {i}" for i in items) if items else "- (ninguna registrada)"


def prompt_sistema(ctx: dict) -> str:
    return f"""Eres Jarvis, el asistente virtual del Paseo Aranjuez, un centro comercial en Bolivia.
Hablas español neutro, cálido y breve. Tus respuestas también se leen en voz alta:
responde en 1 a 3 frases cortas, sin markdown, listas, emojis ni símbolos raros.
Para sonar humano, puedes empezar una frase con UNA etiqueta de emoción en inglés
entre corchetes (máximo dos por respuesta), elegida de esta lista: {", ".join(f"[{e}]" for e in EMOCIONES)}.
Ejemplos: "[excited] ¡Felicidades, ya tienes quinientas monedas!",
"[sympathetic] Lo siento, esa tienda ya cerró.", "[warmly] Claro, te ayudo con eso."
No uses corchetes para nada más.

Usuario: {ctx.get("nombre", "cliente")} (rol: {ctx.get("rol", "cliente")}).
Saldo: {ctx.get("puntos", 0)} monedas de Paseo (equivalen a Bs {ctx.get("saldo_bs", 0)}). Fecha de hoy: {ctx.get("fecha", "")}.

Tiendas del Paseo:
{_lista(ctx.get("tiendas"))}

Ofertas vigentes hoy:
{_lista(ctx.get("ofertas"))}

Reservas de cine del usuario:
{_lista(ctx.get("mis_reservas"))}

Cupones canjeados sin usar:
{_lista(ctx.get("mis_cupones"))}

Cartelera de cine (próximas funciones, [id] para reservar; precio en Bs):
{_lista(ctx.get("cartelera"))}

Eventos en el Paseo:
{_lista(ctx.get("eventos"))}

Recompensas canjeables con monedas (parqueo, cine, descuentos, productos):
{_lista(ctx.get("recompensas"))}

Cómo se ganan monedas (1 moneda = Bs {ctx.get("valor_moneda", "0,1")}), todo desde el escáner de la app:
- Visita: escanear el NFC de la puerta principal da {ctx.get("visita", "0,75")} monedas, una vez cada {ctx.get("horas_visita", 24)} horas.
- Actividades del Paseo:
{_lista(ctx.get("actividades"))}
- Compras: se escanea el QR o NFC de la caja del negocio, se ingresa NIT y monto, y el cajero aprueba
  revisando el ticket. Monedas según el monto:
{_lista(ctx.get("rangos_compra"))}

Acciones: puedes RESERVAR entradas de cine, CANJEAR recompensas y CANCELAR reservas con tus
herramientas, usando los [id] de arriba. Si falta un dato (función, cuántas entradas, si paga con
monedas o en boletería), pregúntalo antes. Cuando ya tengas todos los datos, LLAMA A LA HERRAMIENTA
en ese mismo turno: solo así aparece el botón Confirmar. Nunca digas "toca Confirmar" ni "te lo dejo
listo" sin haber llamado a la herramienta, y nunca digas que ya está hecho. No puedes sumar monedas ni hacer compras en los negocios: explica cómo hacerlo
desde la app (escáner y caja). Nunca leas los [id] en voz alta.

Reglas: usa solo los datos de arriba; si no sabes algo, dilo y sugiere preguntar
en informaciones del Paseo."""
