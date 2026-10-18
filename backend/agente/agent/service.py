"""Capa de servicio sobre el grafo: punto único que usa la API.

Patrón portado de TorreSegura. Encapsula construir el grafo con el
checkpointer durable, iniciar/continuar un thread por usuario y reanudar una
acción tras la confirmación autenticada (interrupt de LangGraph).
"""

from functools import lru_cache
from typing import Any, Dict

from django.utils import timezone

from ..contexto import construir_contexto
from ..models import ConversacionJarvis, MensajeJarvis
from .checkpoints import get_checkpoint_runtime
from .graph import MAX_HISTORIAL, build_agent_graph


class AgentConversationService:
    def __init__(self):
        runtime = get_checkpoint_runtime()
        self._graph = build_agent_graph(checkpointer=runtime.saver)

    def _config(self, thread_id: str) -> Dict[str, Any]:
        return {"configurable": {"thread_id": thread_id}}

    @staticmethod
    def _historial_desde_bd(conversacion: ConversacionJarvis) -> list[dict[str, str]]:
        """Obtiene los últimos turnos en orden cronológico para el LLM."""
        recientes = list(
            MensajeJarvis.objects.filter(conversacion=conversacion)
            .order_by("-creado_en", "-id")
            .values("rol", "contenido")[:MAX_HISTORIAL]
        )
        roles = {
            MensajeJarvis.Rol.USUARIO: "user",
            MensajeJarvis.Rol.ASISTENTE: "assistant",
        }
        return [
            {"role": roles[mensaje["rol"]], "content": mensaje["contenido"]}
            for mensaje in reversed(recientes)
            if mensaje["rol"] in roles and mensaje["contenido"].strip()
        ]

    @staticmethod
    def _actualizar_conversacion(conversacion: ConversacionJarvis) -> None:
        ConversacionJarvis.objects.filter(
            pk=conversacion.pk,
            archivada_en__isnull=True,
        ).update(actualizada_en=timezone.now())

    def chat(
        self,
        user,
        conversacion: ConversacionJarvis,
        message: str,
        origen: str = MensajeJarvis.Origen.TEXTO,
    ) -> Dict[str, Any]:
        """Procesa y persiste un turno de una conversación activa del usuario."""
        if conversacion.usuario_id != user.id or conversacion.archivada_en is not None:
            raise ValueError("La conversación no pertenece al usuario o está archivada.")
        if not ConversacionJarvis.objects.filter(
            pk=conversacion.pk,
            usuario_id=user.id,
            archivada_en__isnull=True,
        ).exists():
            raise ValueError("La conversación no pertenece al usuario o está archivada.")

        contenido = (message or "").strip()
        if not contenido:
            raise ValueError("El mensaje no puede estar vacío.")
        if origen not in MensajeJarvis.Origen.values:
            raise ValueError("El origen del mensaje no es válido.")

        # Cada operación de base de datos es breve: nunca se mantiene una
        # transacción abierta mientras el proveedor LLM responde.
        MensajeJarvis.objects.create(
            conversacion=conversacion,
            rol=MensajeJarvis.Rol.USUARIO,
            contenido=contenido,
            origen=origen,
        )
        self._actualizar_conversacion(conversacion)

        thread_id = str(conversacion.thread_id)
        state = {
            # Esto mantiene el checkpoint operativo, pero el LLM recibirá
            # ``history_messages`` desde BD y no este acumulado del checkpoint.
            "messages": [{"role": "user", "content": contenido}],
            "history_messages": self._historial_desde_bd(conversacion),
            "thread_id": thread_id,
            "conversation_id": str(conversacion.id),
            "user_id": user.id,
            "authenticated_context": construir_contexto(user),
        }
        result = self._graph.invoke(state, config=self._config(thread_id))
        presentation = result.get("presentation") or {}

        respuesta = (presentation.get("text") or "").strip()
        if respuesta:
            metadatos = (
                {"guardrail_triggered": True}
                if result.get("guardrail_triggered")
                else {}
            )
            mensaje_asistente = MensajeJarvis.objects.create(
                conversacion=conversacion,
                rol=MensajeJarvis.Rol.ASISTENTE,
                contenido=respuesta,
                origen=MensajeJarvis.Origen.TEXTO,
                metadatos=metadatos,
            )
            self._actualizar_conversacion(conversacion)
            # Dato efímero para que la capa API pueda asociar tarjetas públicas
            # con este turno exacto. Los endpoints lo eliminan antes de responder.
            presentation["_mensaje_asistente_id"] = mensaje_asistente.pk
        return presentation

    def resume_confirmation(self, user, accion) -> Dict[str, Any]:
        """Reanuda el grafo tras confirmar una acción pendiente (interrupt).

        TODO: usar el thread_id de la acción y pasar la decisión del usuario.
        """
        if accion.usuario_id != user.id:
            raise ValueError("La acción no pertenece al usuario.")

        thread_id = accion.thread_id
        if accion.conversacion_id:
            conversacion = accion.conversacion
            if (
                conversacion.usuario_id != user.id
                or conversacion.archivada_en is not None
            ):
                raise ValueError("La conversación no pertenece al usuario o está archivada.")
            thread_id = str(conversacion.thread_id)

        config = self._config(thread_id)
        result = self._graph.invoke(None, config=config)
        return result.get("presentation") or {}


@lru_cache(maxsize=1)
def get_conversation_service() -> AgentConversationService:
    return AgentConversationService()
