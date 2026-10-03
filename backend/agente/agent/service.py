"""Capa de servicio sobre el grafo: punto único que usa la API.

Patrón portado de TorreSegura. Encapsula construir el grafo con el
checkpointer durable, iniciar/continuar un thread por usuario y reanudar una
acción tras la confirmación autenticada (interrupt de LangGraph).
"""

from functools import lru_cache
from typing import Any, Dict

from ..contexto import construir_contexto
from .checkpoints import get_checkpoint_runtime
from .graph import build_agent_graph


class AgentConversationService:
    def __init__(self):
        runtime = get_checkpoint_runtime()
        self._graph = build_agent_graph(checkpointer=runtime.saver)

    def _config(self, thread_id: str) -> Dict[str, Any]:
        return {"configurable": {"thread_id": thread_id}}

    def chat(self, user, thread_id: str, message: str) -> Dict[str, Any]:
        """Procesa un turno del usuario y devuelve {"text": respuesta}."""
        state = {
            "messages": [{"role": "user", "content": message}],
            "thread_id": thread_id,
            "user_id": user.id,
            # Se recalcula en cada turno: puntos y ofertas siempre al día.
            "authenticated_context": construir_contexto(user),
        }
        result = self._graph.invoke(state, config=self._config(thread_id))
        return result.get("presentation") or {}

    def resume_confirmation(self, user, accion) -> Dict[str, Any]:
        """Reanuda el grafo tras confirmar una acción pendiente (interrupt).

        TODO: usar el thread_id de la acción y pasar la decisión del usuario.
        """
        config = self._config(accion.thread_id)
        result = self._graph.invoke(None, config=config)
        return result.get("presentation") or {}


@lru_cache(maxsize=1)
def get_conversation_service() -> AgentConversationService:
    return AgentConversationService()
