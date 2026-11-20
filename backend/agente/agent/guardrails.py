"""Guardias deterministas para respuestas generadas por el modelo.

Patrón portado de TorreSegura: evita que el modelo afirme haber ejecutado una
acción (crear/registrar/confirmar algo) cuando no hubo una tool verificada.
Ajusta los patrones al vocabulario de tu dominio ERP.
"""

import re
import unicodedata
from decimal import Decimal
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


# --- Montos: Jarvis solo puede decir precios y monedas que están en los datos reales ---------------------

_NUMERO = r"\d+(?:[.,]\d{1,2})?"
_BS_EN_DATOS = re.compile(rf"\bBs\.?\s*({_NUMERO})")
_MONEDAS_EN_DATOS = re.compile(rf"({_NUMERO})\s+monedas\b")
_MONTO_EN_RESPUESTA = re.compile(rf"(?<![\d.,])({_NUMERO})\s+(bolivianos?|monedas?)\b", re.IGNORECASE)
# "cincuenta bolivianos": en palabras no se puede verificar, así que se pide escribirlo con cifras.
_MONTO_EN_PALABRAS = re.compile(
    r"\b(?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci\w+|"
    r"veinte|veinti\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|\w+cientos|"
    r"\w+cientas|quinientos|quinientas|mil)\s+(?:y\s+\w+\s+)?(?:bolivianos?|monedas?)\b",
    re.IGNORECASE,
)
MAX_UNIDADES = 10  # "5 lattes de 20" = 100: se aceptan cantidades de 1 a 10 de un mismo precio

MENSAJE_MONTO_NO_VERIFICADO = (
    "Prefiero no darte un monto que no puedo verificar. Mira el precio exacto en la ficha del local "
    "o pregúntame por un plato o una entrada en concreto."
)

_CONFIRMAR_SIN_ACCION = re.compile(r"[^.!?]*\btoca\s+confirmar\b[^.!?]*[.!?]?", re.IGNORECASE)


def _decimal(texto: str) -> Decimal:
    return Decimal(texto.replace(",", "."))


# "[12] Latte de vainilla Bs 20" en el Menú del contexto: nombre del plato y su precio.
_PLATO_EN_DATOS = re.compile(rf"(?:\]\s*|;\s*|Menú:\s*)([^;\[\]:\n]+?)\s+Bs\s*({_NUMERO})")


def _palabras(texto: str) -> set:
    """Palabras normalizadas (sin tildes ni plural): "Lattes" y "latte" cuentan igual."""
    normal = unicodedata.normalize("NFKD", texto.lower())
    normal = "".join(c for c in normal if not unicodedata.combining(c))
    return {p.rstrip("s") for p in re.findall(r"[a-zñ]{4,}", normal)}


def _precios_nombrados(respuesta: str, datos: str) -> set:
    """Precios de los platos del Menú que la respuesta nombra (todas sus palabras importantes aparecen)."""
    palabras = _palabras(respuesta)
    return {
        _decimal(precio) for nombre, precio in _PLATO_EN_DATOS.findall(datos)
        if _palabras(nombre) and _palabras(nombre) <= palabras
    }


def _respaldado(monto: Decimal, base: set, combinar: bool, diferencias: bool) -> bool:
    multiplos = {valor * k for valor in base for k in range(1, MAX_UNIDADES + 1)}
    if monto in multiplos:
        return True
    # Varios platos: con los platos nombrados se combinan cantidades; sin nombrarlos, solo un plato extra.
    sumandos = multiplos if combinar else base
    if any((monto - m) in multiplos for m in sumandos if m < monto):
        return True
    # "te faltan 84 monedas": costo de una recompensa menos el saldo
    return diferencias and any((valor - monto) in base for valor in base)


def montos_sin_respaldo(respuesta: str, datos: str) -> list:
    """Montos de la respuesta que no salen de los datos reales del contexto (precios en Bs y monedas).

    Si la respuesta nombra platos del Menú, los bolivianos tienen que salir de ESOS platos
    ("cinco lattes son 110" falla aunque 110 se pueda armar con otros platos).
    """
    nombrados = _precios_nombrados(respuesta or "", datos)
    precios = nombrados or {_decimal(n) for n in _BS_EN_DATOS.findall(datos)}
    monedas = {_decimal(n) for n in _MONEDAS_EN_DATOS.findall(datos)}
    dudosos = []
    for numero, unidad in _MONTO_EN_RESPUESTA.findall(respuesta or ""):
        es_moneda = unidad.lower().startswith("moneda")
        base = monedas if es_moneda else precios
        if not _respaldado(_decimal(numero), base, combinar=es_moneda or bool(nombrados), diferencias=es_moneda):
            dudosos.append(f"{numero} {unidad}")
    return dudosos + [m.group(0) for m in _MONTO_EN_PALABRAS.finditer(respuesta or "")]


def quitar_confirmar_sin_accion(texto: str) -> str:
    """Sin propuesta nueva no hay botón Confirmar: se quita la frase que lo pide (y que confundiría al usuario)."""
    return re.sub(r"\s{2,}", " ", _CONFIRMAR_SIN_ACCION.sub("", texto or "")).strip()
