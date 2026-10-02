"""Trazas/métricas del agente (esqueleto).

En TorreSegura esto integra LangSmith y metadatos de traza. Deja los hooks
listos y conéctalos cuando definas el pipeline de observabilidad.
"""

import logging

logger = logging.getLogger("agente")


def trace_turn(thread_id: str, intent: str, **meta):
    logger.info("agent.turn thread=%s intent=%s meta=%s", thread_id, intent, meta)
