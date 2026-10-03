"""Grafo conversacional del agente ERP (esqueleto genérico).

Reproduce la arquitectura de TorreSegura sin su dominio: un grafo LangGraph
con nodos entender -> planear -> (confirmar) -> ejecutar tool -> presentar,
y un interrupt antes de ejecutar acciones que modifican datos.

Rellena cada nodo con la lógica de tu dominio (locales, contratos, finanzas…).
"""

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
from ..voz import quitar_emociones
from .guardrails import guard_unverified_action_claim
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
    texto = f"[warmly] Te lo dejo listo: {resumen}. Toca Confirmar para terminar."
    return texto, {"id": accion.id, "tipo": nombre, "resumen": resumen}


def _presentar(state: AgentState) -> dict:
    """Redacta la respuesta final con el LLM y aplica los guardrails."""
    system = prompt_sistema(state.get("authenticated_context") or {})
    accion = None
    try:
        draft, llamadas = get_llm_adapter().chat_con_herramientas(
            system, _historial(state), herramientas.definiciones_openai()
        )
        llm_ok = True
        if llamadas:
            draft, accion = _proponer_accion(state, *llamadas[0])
        draft = draft or "¿En qué puedo ayudarte?"
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
