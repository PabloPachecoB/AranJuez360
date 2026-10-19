"""Trazas/métricas del agente (esqueleto).

En TorreSegura esto integra LangSmith y metadatos de traza. Deja los hooks
listos y conéctalos cuando definas el pipeline de observabilidad.
"""

import logging

logger = logging.getLogger("agente")


def trace_turn(intent: str, **meta):
    """Registra metadatos seguros de un turno, sin el hilo interno."""
    meta.pop("thread_id", None)
    logger.info("agent.turn intent=%s meta=%s", intent, meta)
