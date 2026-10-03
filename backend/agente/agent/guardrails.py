"""Guardias deterministas para respuestas generadas por el modelo.

Patrón portado de TorreSegura: evita que el modelo afirme haber ejecutado una
acción (crear/registrar/confirmar algo) cuando no hubo una tool verificada.
Ajusta los patrones al vocabulario de tu dominio ERP.
"""

import re
import unicodedata
from typing import Tuple


UNVERIFIED_ACTION_MESSAGE = (
    "No puedo presentar esta solicitud como ejecutada porque no existe una "
    "acción verificada. Puedo ayudarte a preparar un borrador, pero la acción "
    "solo queda registrada después de la confirmación autenticada y la "
    "verificación del backend."
)

_ACTION_CLAIM_PATTERNS = tuple(
    re.compile(pattern)
    for pattern in (
        r"\bgracias\s+por\s+confirmar\b",
        (
            r"\b(?:esta|ya\s+esta|ha\s+sido|fue|quedo|se\s+encuentra)\s+"
            r"(?:confirmad[oa]|programad[oa]|agendad[oa]|cread[oa]|"
            r"registrad[oa]|procesad[oa])s?\b"
        ),
        (
            r"\b(?:he|hemos|se\s+ha|ya\s+se)\s+"
            r"(?:confirmado|programado|agendado|creado|registrado|procesado)\b"
        ),
        r"\b(?:confirmacion|registro|operacion)\s+(?:completad[oa]|exitosa?)\b",
    )
)


def guard_unverified_action_claim(response: str) -> Tuple[str, bool]:
    """Reemplaza afirmaciones de ejecución sin respaldo de una herramienta."""
    normalized = unicodedata.normalize("NFKD", response)
    normalized = "".join(c for c in normalized if not unicodedata.combining(c)).lower()
    if any(pattern.search(normalized) for pattern in _ACTION_CLAIM_PATTERNS):
        return UNVERIFIED_ACTION_MESSAGE, True
    return response, False
