"""Asistente de análisis para el administrador: consulta los datos reales del Paseo (solo lectura)
y responde con cifras exactas, patrones y sugerencias de campañas."""
import json
from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from reportes import auditoria, services
from reportes.geografia import mapa_clientes
from usuarios.permissions import EsAdmin

from .llm import LLMError, get_llm_adapter

MAX_RONDAS = 5
MAX_CARACTERES_DATOS = 9000

TEMAS = {
    "resumen": "Indicadores generales: clientes, visitas, compras, monto, monedas.",
    "compras_por_dia": "Compras aprobadas y monto por día.",
    "visitas_por_dia": "Visitas al Paseo por día.",
    "horas_pico": "Visitas por hora del día.",
    "dias_semana": "Visitas y compras por día de la semana.",
    "ranking_negocios": "Negocios ordenados por compras/monto, con clientes y % de rechazo.",
    "negocios_sin_actividad": "Negocios sin compras en los últimos N días.",
    "clientes_frecuentes": "Clientes con más visitas, con compras, monto y procedencia.",
    "clientes_dormidos": "Clientes que no vienen hace N días.",
    "procedencia": "De dónde vienen los clientes (provincias/ciudades) y cuánto compran.",
    "perfil_edad_ocupacion": "Clientes por rango de edad y por ocupación (estudiante, universitario, profesional...).",
    "mapa_clientes": "Clientes por zona/ciudad con edades, ocupaciones, ticket y recurrencia.",
    "pedidos": "Pedidos de comida: por estado, ventas, negocios con más pedidos, horas de retiro.",
    "escenario_eventos": "Propuestas del Escenario abierto por estado y cupos reservados en eventos.",
    "movimientos_recientes": "Últimos movimientos registrados (auditoría).",
}

HERRAMIENTA = {
    "type": "function",
    "function": {
        "name": "consultar_datos",
        "description": "Consulta datos reales del Paseo. Úsala SIEMPRE antes de dar cualquier cifra; "
                       "puedes llamarla varias veces con distintos temas. Temas: "
                       + "; ".join(f"{k} = {v}" for k, v in TEMAS.items()),
        "parameters": {
            "type": "object",
            "properties": {
                "tema": {"type": "string", "enum": list(TEMAS)},
                "dias": {"type": "integer", "description": "Periodo en días hacia atrás desde hoy (por defecto 30)."},
                "limite": {"type": "integer", "description": "Máximo de filas en rankings (por defecto 10)."},
                "orden": {"type": "string", "enum": ["visitas", "compras", "monto", "puntos"],
                          "description": "Solo clientes_frecuentes."},
                "procedencia": {"type": "string", "description": "Filtrar por procedencia (código) si se conoce."},
            },
            "required": ["tema"],
        },
    },
}


def _pedidos(desde):
    from pedidos.models import Pedido
    qs = Pedido.objects.filter(creado_en__date__gte=desde)
    por_estado = {f["estado"]: f["n"] for f in qs.values("estado").annotate(n=Count("id"))}
    pagados = qs.filter(pagado_en__isnull=False).exclude(estado=Pedido.Estado.CANCELADO)
    top = pagados.values("empresa__nombre").annotate(pedidos=Count("id"), total=Sum("total")).order_by("-pedidos")[:10]
    horas = {}
    for p in pagados.exclude(retiro_programado=None).values_list("retiro_programado", flat=True):
        h = timezone.localtime(p).hour
        horas[h] = horas.get(h, 0) + 1
    return {
        "pedidos": qs.count(), "por_estado": por_estado,
        "vendido_bs": pagados.aggregate(t=Sum("total"))["t"] or 0,
        "negocios_con_mas_pedidos": [
            {"negocio": f["empresa__nombre"], "pedidos": f["pedidos"], "total_bs": f["total"]} for f in top],
        "retiros_programados_por_hora": dict(sorted(horas.items())),
    }


def _escenario(desde):
    from entretenimiento.models import Propuesta, ReservaEvento
    props = {f["estado"]: f["n"] for f in Propuesta.objects.filter(creado_en__date__gte=desde)
             .values("estado").annotate(n=Count("id"))}
    reservas = {f["estado"]: f["n"] for f in ReservaEvento.objects.filter(creado_en__date__gte=desde)
                .values("estado").annotate(n=Count("id"))}
    return {"propuestas_por_estado": props, "reservas_evento_por_estado": reservas}


def ejecutar_consulta(tema, dias=30, limite=10, orden="visitas", procedencia=None):
    """Devuelve datos serializables del tema pedido. Lanza ValueError si el tema no existe."""
    dias = min(max(int(dias or 30), 1), 365)
    limite = min(max(int(limite or 10), 1), 30)
    hasta = timezone.localdate()
    desde = hasta - timedelta(days=dias - 1)
    procedencia = procedencia or None
    if tema == "resumen":
        return services.resumen(desde, hasta)
    if tema == "compras_por_dia":
        return services.compras_por_dia(desde, hasta, procedencia)
    if tema == "visitas_por_dia":
        return services.visitas_por_dia(desde, hasta, procedencia)
    if tema == "horas_pico":
        return services.horas_pico(desde, hasta)
    if tema == "dias_semana":
        return services.dias_semana(desde, hasta)
    if tema == "ranking_negocios":
        return services.ranking_empresas(desde, hasta)[:limite]
    if tema == "negocios_sin_actividad":
        return services.empresas_sin_actividad(dias)[:limite]
    if tema == "clientes_frecuentes":
        filas = services.clientes_frecuentes(desde, hasta, orden or "visitas", limite, procedencia)
        # Sin correos: el análisis no necesita datos de contacto.
        return [{k: v for k, v in dict(f).items() if k not in ("email", "username")} for f in filas]
    if tema == "clientes_dormidos":
        filas = services.clientes_dormidos(dias)
        return {"total": len(filas), "ejemplos": [
            {k: v for k, v in dict(f).items() if k not in ("email", "username")} for f in filas[:limite]]}
    if tema == "procedencia":
        return services.clientes_por_procedencia(desde, hasta)
    if tema == "perfil_edad_ocupacion":
        return services.perfil_clientes(desde, hasta)
    if tema == "mapa_clientes":
        return mapa_clientes(desde, hasta)
    if tema == "pedidos":
        return _pedidos(desde)
    if tema == "escenario_eventos":
        return _escenario(desde)
    if tema == "movimientos_recientes":
        return auditoria.eventos(limite=min(limite * 3, 60))
    raise ValueError(f"Tema desconocido: {tema}")


def _datos_texto(tema, args):
    try:
        datos = ejecutar_consulta(tema, args.get("dias", 30), args.get("limite", 10),
                                  args.get("orden", "visitas"), args.get("procedencia"))
        texto = json.dumps(datos, default=str, ensure_ascii=False)
    except ValueError as exc:
        texto = json.dumps({"error": str(exc)})
    except Exception as exc:  # una consulta fallida no debe tumbar el chat
        texto = json.dumps({"error": f"No se pudo consultar: {exc}"})
    return texto[:MAX_CARACTERES_DATOS]


def prompt_sistema():
    hoy = timezone.localdate().isoformat()
    return (
        "Eres el analista de datos del administrador del centro comercial Paseo Aranjuez (Cochabamba, Bolivia). "
        f"Hoy es {hoy}. Respondes en español, claro y directo, para una persona de negocio.\n"
        "REGLAS:\n"
        "- Toda cifra sale de la herramienta consultar_datos. Llámala (varias veces si hace falta) antes de responder; "
        "nunca inventes números, nombres ni porcentajes. Si no hay datos, dilo.\n"
        "- Los montos son en bolivianos: escribe 'Bs 1.250' o 'bolivianos', nunca solo el número.\n"
        "- Indica siempre el periodo analizado.\n"
        "- Para patrones: compara, da proporciones, horas/días fuertes y débiles, y qué segmento (edad, ocupación, "
        "procedencia/comunidad) concentra la actividad.\n"
        "- Para campañas: propón 2 o 3 ideas concretas con público objetivo, canal, momento y por qué (apoyado en los datos). "
        "Marca como 'hipótesis' lo que no se pueda comprobar con los datos.\n"
        "- Eres de solo lectura: no ejecutas cambios. Si piden algo fuera de los datos del Paseo, di que no puedes.\n"
        "- Respuestas cortas; usa listas con viñetas y negritas solo para lo importante. No expongas correos ni teléfonos."
    )


def responder(historial):
    """historial: [{'role': 'user'|'assistant', 'content': str}]. Devuelve (texto, consultas_hechas)."""
    adapter = get_llm_adapter()
    mensajes = [{"role": "system", "content": prompt_sistema()}, *historial]
    consultas = []
    for _ in range(MAX_RONDAS):
        resp = adapter._client.chat.completions.create(
            model=adapter.settings.model, messages=mensajes, temperature=0.2, max_tokens=1500,
            tools=[HERRAMIENTA], extra_body={"enable_thinking": False},
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            return (msg.content or "").strip(), consultas
        mensajes.append({
            "role": "assistant", "content": msg.content or "",
            "tool_calls": [{"id": t.id, "type": "function",
                            "function": {"name": t.function.name, "arguments": t.function.arguments or "{}"}}
                           for t in msg.tool_calls],
        })
        for t in msg.tool_calls:
            try:
                args = json.loads(t.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            tema = args.get("tema", "")
            consultas.append({"tema": tema, "dias": args.get("dias", 30)})
            mensajes.append({"role": "tool", "tool_call_id": t.id, "content": _datos_texto(tema, args)})
    return "Necesité demasiadas consultas para responder. Prueba con una pregunta más concreta.", consultas


@api_view(["POST"])
@permission_classes([EsAdmin])
def chat(request):
    texto = str(request.data.get("mensaje", "")).strip()[:1000]
    if not texto:
        return Response({"detail": "Escribe una pregunta."}, status=400)
    previo = []
    for m in (request.data.get("historial") or [])[-8:]:
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
            previo.append({"role": m["role"], "content": m["content"][:3000]})
    try:
        respuesta, consultas = responder([*previo, {"role": "user", "content": texto}])
    except LLMError as exc:
        return Response({"detail": f"El asistente no está disponible ahora: {exc}"}, status=503)
    except Exception as exc:
        return Response({"detail": f"El asistente no pudo responder: {exc}"}, status=503)
    return Response({"respuesta": respuesta, "consultas": consultas})
