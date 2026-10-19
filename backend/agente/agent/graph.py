"""Grafo conversacional del agente ERP (esqueleto genérico).

Reproduce la arquitectura de TorreSegura sin su dominio: un grafo LangGraph
con nodos entender -> planear -> (confirmar) -> ejecutar tool -> presentar,
y un interrupt antes de ejecutar acciones que modifican datos.

Rellena cada nodo con la lógica de tu dominio (locales, contratos, finanzas…).
"""

import re
import logging
from typing import Optional

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, StateGraph

from ..contexto import prompt_sistema
from fidelizacion.services import ReglaNegocioError
from usuarios.models import Usuario

from .. import herramientas
from ..llm import LLMError, get_llm_adapter

from ..models import AgentAction
from ..voz import en_bolivianos, quitar_emociones
from .guardrails import (
    MENSAJE_MONTO_NO_VERIFICADO,
    MENSAJE_SIN_ACCION,
    guard_unverified_action_claim,
    montos_sin_respaldo,
    promete_accion_sin_herramienta,
    quitar_confirmar_sin_accion,
)
from .state import AgentState

logger = logging.getLogger(__name__)

# Turnos previos que se envían al LLM (el checkpoint guarda todo el hilo).
MAX_HISTORIAL = 12
RESPUESTA_SIN_LLM = (
    "Ahora mismo no puedo responder, mi conexión con el asistente falló. "
    "Intenta de nuevo en un momento."
)


def _entender(state: AgentState) -> dict:
    """NLU: clasifica intención y extrae campos del último mensaje.

    TODO: conectar el LLM (ver llm.py) o un clasificador determinista.
    """
    return {"intent": state.get("intent", "desconocido"), "llm_invoked": False}


def _planear(state: AgentState) -> dict:
    """Decide qué tool usar y qué campos faltan para ejecutarla.

    TODO: mapear intención -> tool y validar campos con los schemas Pydantic.
    """
    return {"missing_fields": state.get("missing_fields", [])}


def _ejecutar_tool(state: AgentState) -> dict:
    """Ejecuta la tool de dominio ya confirmada y guarda el resultado.

    TODO: invocar la tool correspondiente en agente/tools/ y setear
    verification_status='verified' solo si el backend confirmó el efecto.
    """
    return {"tool_result": None, "verification_status": "unverified"}


def _historial(state: AgentState) -> list:
    """Últimos mensajes del hilo en formato {role, content} para el LLM."""
    historial = []
    for msg in state.get("messages", [])[-MAX_HISTORIAL:]:
        if isinstance(msg, HumanMessage):
            historial.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            historial.append({"role": "assistant", "content": msg.content})
    return historial


def _proponer_accion(state: AgentState, nombre: str, argumentos: dict):
    """Valida la acción que pidió el modelo y la deja PENDIENTE de confirmación en la app.

    El texto lo arma el backend (no el modelo) para que nunca diga que ya lo hizo.
    """
    user = Usuario.objects.get(pk=state["user_id"])
    try:
        resumen, payload = herramientas.preparar(nombre, user, argumentos)
    except ReglaNegocioError as exc:
        return f"[sympathetic] {exc}", None
    # Una sola propuesta abierta por conversación: la anterior queda descartada.
    AgentAction.objects.filter(
        usuario=user, thread_id=state.get("thread_id", ""), estado=AgentAction.Estado.PENDIENTE
    ).update(estado=AgentAction.Estado.RECHAZADA)
    accion = AgentAction.objects.create(
        usuario=user, thread_id=state.get("thread_id", ""), tipo_accion=nombre,
        payload={**payload, "resumen": resumen},
    )
    # Jarvis no lee montos ni totales: la tarjeta de la app muestra el detalle exacto que calculó el backend.
    texto = "[warmly] Te lo dejo listo. Revisa el detalle y toca Confirmar."
    return texto, {"id": accion.id, "tipo": nombre, "resumen": resumen, "detalle": payload.get("detalle")}


def _verificar_montos(system: str, state: AgentState, draft: str) -> str:
    """Texto libre del modelo: cada monto (Bs o monedas) debe salir de los datos reales del contexto.

    Si inventa uno, se le pide una vez que lo corrija; si insiste, no se muestra ningún monto. Además se
    quita "toca Confirmar" cuando en este turno no hubo propuesta (no hay botón que tocar).
    """
    dudosos = montos_sin_respaldo(en_bolivianos(draft or ""), system)
    if dudosos:
        logger.warning("Jarvis dio montos que no están en los datos: %s", dudosos)
        aviso = {
            "role": "user",
            "content": f"(Instrucción interna: estos montos no están en los datos: {', '.join(dudosos)}. "
                       "Responde de nuevo usando solo precios y monedas exactos de los datos, escritos con "
                       "cifras, o sin dar montos. No llames herramientas.)",
        }
        try:
            corregido = get_llm_adapter().chat(system, [*_historial(state), aviso])
        except (LLMError, ValueError):
            corregido = ""
        draft = corregido if corregido and not montos_sin_respaldo(en_bolivianos(corregido), system)             else MENSAJE_MONTO_NO_VERIFICADO
    return quitar_confirmar_sin_accion(draft) or "¿En qué más te ayudo?"


def _presentar(state: AgentState) -> dict:
    """Redacta la respuesta final con el LLM y aplica los guardrails."""
    system = prompt_sistema(state.get("authenticated_context") or {})
    accion = None
    try:
        draft, llamadas = get_llm_adapter().chat_con_herramientas(
            system, _historial(state), herramientas.definiciones_openai()
        )
        llm_ok = True
        if not llamadas and promete_accion_sin_herramienta(draft):
            # El modelo escribió "te dejo el pedido..." sin llamar a la herramienta: no existe ningún pedido ni
            # botón Confirmar. Se le pide una vez que la llame con los datos de la conversación.
            aviso = {
                "role": "user",
                "content": "(Instrucción interna: ya tienes todos los datos. Llama ahora a la herramienta que "
                           "corresponde, sin escribir texto de confirmación.)",
            }
            draft, llamadas = get_llm_adapter().chat_con_herramientas(
                system, [*_historial(state), aviso], herramientas.definiciones_openai()
            )
            if not llamadas and promete_accion_sin_herramienta(draft):
                draft = MENSAJE_SIN_ACCION
        if llamadas:
            draft, accion = _proponer_accion(state, *llamadas[0])
        else:
            draft = _verificar_montos(system, state, draft)
        # Los [id] son internos: si el modelo los repite, se quitan (la voz los leería en voz alta).
        draft = en_bolivianos(re.sub(r"\s*\[\d+\]", "", draft or "").strip()) or "¿En qué puedo ayudarte?"
    except (LLMError, ValueError) as exc:
        logger.warning("LLM no disponible: %s", exc)
        draft, llm_ok = RESPUESTA_SIN_LLM, False
    # `voz` conserva las etiquetas [emoción] para ElevenLabs; `text` va limpio a la pantalla.
    texto = quitar_emociones(draft)
    safe, triggered = guard_unverified_action_claim(texto)
    voz = safe if triggered else draft
    return {
        "messages": [AIMessage(content=safe)],
        "presentation": {"text": safe, "voz": voz, "accion": accion},
        "guardrail_triggered": triggered,
        "llm_invoked": llm_ok,
    }


def _necesita_confirmacion(state: AgentState) -> str:
    """Rama: si la acción propuesta modifica datos, pedir confirmación."""
    if state.get("proposed_action"):
        return "ejecutar"
    return "presentar"


def build_agent_graph(checkpointer=None):
    """Construye y compila el grafo. `checkpointer=None` lo gestiona el
    Agent Server en desarrollo; en runtime se pasa el SqliteSaver."""
    builder = StateGraph(AgentState)
    builder.add_node("entender", _entender)
    builder.add_node("planear", _planear)
    builder.add_node("ejecutar", _ejecutar_tool)
    builder.add_node("presentar", _presentar)

    builder.set_entry_point("entender")
    builder.add_edge("entender", "planear")
    builder.add_conditional_edges(
        "planear",
        _necesita_confirmacion,
        {"ejecutar": "ejecutar", "presentar": "presentar"},
    )
    builder.add_edge("ejecutar", "presentar")
    builder.add_edge("presentar", END)

    # Interrupt antes de ejecutar: el usuario confirma desde la app (ver api.py).
    return builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["ejecutar"],
    )
