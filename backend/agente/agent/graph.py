"""Grafo conversacional del agente ERP (esqueleto genérico).

Reproduce la arquitectura de TorreSegura sin su dominio: un grafo LangGraph
con nodos entender -> planear -> (confirmar) -> ejecutar tool -> presentar,
y un interrupt antes de ejecutar acciones que modifican datos.

Rellena cada nodo con la lógica de tu dominio (locales, contratos, finanzas…).
"""

from typing import Optional

from langgraph.graph import END, StateGraph

from .guardrails import guard_unverified_action_claim
from .state import AgentState


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


def _presentar(state: AgentState) -> dict:
    """Redacta la respuesta final y aplica los guardrails."""
    draft = "¿En qué puedo ayudarte?"
    safe, triggered = guard_unverified_action_claim(draft)
    return {
        "presentation": {"text": safe},
        "guardrail_triggered": triggered,
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
