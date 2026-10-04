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


# "Te dejo el pedido...", "te lo reservo...": el modelo promete algo que solo existe si llamó a la herramienta.
_PROMESA_DE_ACCION = tuple(
    re.compile(p)
    for p in (
        r"\bte\s+(?:lo|la|los|las)\s+(?:dejo|reservo|pido|separo|aparto|encargo|programo)\b",
        r"\bte\s+(?:dejo|reservo|pido|separo|aparto|encargo|programo)\s+(?:listo|lista|el\s+pedido|tu\s+pedido|la\s+reserva|tu\s+reserva|reservad[oa])",
        r"\bdejo\s+(?:el|tu)\s+(?:pedido|reserva)\b",
        r"\b(?:queda|quedo|esta)\s+(?:listo|lista|reservad[oa]|pedid[oa])\b",
    )
)

MENSAJE_SIN_ACCION = (
    "No logré dejar la solicitud lista. Dime otra vez qué plato o evento quieres, "
    "cuántos y, si es comida, si la retiras ya o a qué hora."
)


def promete_accion_sin_herramienta(response: str) -> bool:
    """True si el texto promete dejar listo un pedido o reserva (y no es una pregunta al usuario)."""
    normalized = unicodedata.normalize("NFKD", response or "")
    normalized = "".join(c for c in normalized if not unicodedata.combining(c)).lower()
    if "?" in normalized:  # "te lo reservo, ¿cuál prefieres?" sigue pidiendo datos: no es una promesa cumplida
        return False
    return any(p.search(normalized) for p in _PROMESA_DE_ACCION)


def guard_unverified_action_claim(response: str) -> Tuple[str, bool]:
    """Reemplaza afirmaciones de ejecución sin respaldo de una herramienta."""
    normalized = unicodedata.normalize("NFKD", response)
    normalized = "".join(c for c in normalized if not unicodedata.combining(c)).lower()
    if any(pattern.search(normalized) for pattern in _ACTION_CLAIM_PATTERNS):
        return UNVERIFIED_ACTION_MESSAGE, True
    return response, False
