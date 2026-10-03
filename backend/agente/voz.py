"""Voz de Jarvis: convierte texto en audio MP3.

1. ElevenLabs (modelo eleven_v3) si hay ELEVENLABS_API_KEY: voz muy humana que
   interpreta etiquetas de emoción como [excited] o [warmly].
2. Respaldo gratis: edge-tts (voces neuronales de Microsoft Edge, sin API key),
   que no entiende emociones, así que se le quitan las etiquetas.
"""

import hashlib
import logging
import os
import re

import edge_tts
import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

VOZ_EDGE_POR_DEFECTO = "es-BO-SofiaNeural"
VOZ_ELEVENLABS_POR_DEFECTO = "cgSgspJ2msm6clMCkdW9"  # Jessica: alegre y cálida
MODELO_ELEVENLABS_POR_DEFECTO = "eleven_v3"
MAX_CARACTERES = 1000
CACHE_SEGUNDOS = 24 * 3600  # una frase repetida no vuelve a gastar créditos

# Etiquetas de emoción que Jarvis puede usar (ElevenLabs v3 las interpreta).
EMOCIONES = ("excited", "cheerfully", "warmly", "sympathetic", "curious", "laughs", "sighs")
_ETIQUETA = re.compile(r"\[[a-zA-Z ]{2,30}\]\s*")


class VozError(Exception):
    """No se pudo generar el audio."""


def quitar_emociones(texto: str) -> str:
    """Texto sin etiquetas [emoción], para mostrar en pantalla o voces sin emociones."""
    return re.sub(r"\s{2,}", " ", _ETIQUETA.sub("", texto)).strip()


def _elevenlabs(texto: str, api_key: str) -> bytes:
    voz = os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or VOZ_ELEVENLABS_POR_DEFECTO
    modelo = os.environ.get("ELEVENLABS_MODEL", "").strip() or MODELO_ELEVENLABS_POR_DEFECTO
    resp = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voz}",
        params={"output_format": "mp3_44100_128"},
        headers={"xi-api-key": api_key},
        json={"text": texto, "model_id": modelo, "language_code": "es"},
        timeout=30,
    )
    if resp.status_code != 200:
        raise VozError(f"ElevenLabs {resp.status_code}: {resp.text[:200]}")
    return resp.content


def _edge(texto: str) -> bytes:
    voz = os.environ.get("JARVIS_VOZ", "").strip() or VOZ_EDGE_POR_DEFECTO
    comunicador = edge_tts.Communicate(quitar_emociones(texto), voz, rate="+5%")
    return b"".join(
        chunk["data"] for chunk in comunicador.stream_sync() if chunk["type"] == "audio"
    )


def sintetizar(texto: str) -> bytes:
    """MP3 con `texto` leído por Jarvis (ElevenLabs y, si falla, edge-tts)."""
    texto = texto[:MAX_CARACTERES]
    clave = "jarvis-voz:" + hashlib.sha256(texto.encode()).hexdigest()
    audio = cache.get(clave)
    if audio:
        return audio

    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    audio = b""
    if api_key:
        try:
            audio = _elevenlabs(texto, api_key)
        except (VozError, requests.RequestException) as exc:
            # Créditos agotados, sin red, etc.: Jarvis sigue hablando con edge-tts.
            logger.warning("ElevenLabs no disponible, uso edge-tts: %s", exc)
    if not audio:
        try:
            audio = _edge(texto)
        except Exception as exc:  # edge-tts lanza errores de red/servicio variados
            raise VozError(str(exc)) from exc
    if not audio:
        raise VozError("El servicio de voz no devolvió audio.")
    cache.set(clave, audio, CACHE_SEGUNDOS)
    return audio
