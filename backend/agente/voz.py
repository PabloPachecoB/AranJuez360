"""Voz de Jarvis: convierte texto en audio MP3.

1. Fish Audio o ElevenLabs, según JARVIS_TTS_PROVIDER, para voces con emoción.
2. Respaldo: edge-tts (voces neuronales de Microsoft Edge, sin API key),
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
VOZ_FISH_AUDIO_POR_DEFECTO = ""
MODELO_FISH_AUDIO_POR_DEFECTO = "s2.1-pro"
FISH_AUDIO_URL = "https://api.fish.audio/v1/tts"
MAX_CARACTERES = 1000
CACHE_SEGUNDOS = 24 * 3600  # una frase repetida no vuelve a gastar créditos

# Etiquetas de emoción que admiten los proveedores remotos; edge-tts las elimina.
EMOCIONES = ("excited", "cheerfully", "warmly", "sympathetic", "curious", "laughs", "sighs")
_ETIQUETA = re.compile(r"\[[a-zA-Z ]{2,30}\]\s*")


class VozError(Exception):
    """No se pudo generar el audio."""


_PRECIO = re.compile(r"\bBs\.?\s*(\d+(?:[.,]\d+)?)", re.IGNORECASE)


def en_bolivianos(texto: str) -> str:
    """"Bs 52" -> "52 bolivianos": así la voz no deletrea "be ese" y el precio se entiende."""

    def _convertir(m):
        numero = m.group(1)
        return f"{numero} {'boliviano' if numero == '1' else 'bolivianos'}"

    return _PRECIO.sub(_convertir, texto)


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
        raise VozError(f"ElevenLabs devolvió HTTP {resp.status_code}.")
    return resp.content


def _fish_audio(texto: str, api_key: str) -> bytes:
    voz = os.environ.get("FISH_AUDIO_VOICE_ID", "").strip() or VOZ_FISH_AUDIO_POR_DEFECTO
    modelo = os.environ.get("FISH_AUDIO_MODEL", "").strip() or MODELO_FISH_AUDIO_POR_DEFECTO
    resp = requests.post(
        FISH_AUDIO_URL,
        headers={"Authorization": f"Bearer {api_key}", "model": modelo},
        json={"text": texto, "reference_id": voz, "format": "mp3"},
        timeout=30,
    )
    if resp.status_code != 200:
        raise VozError(f"Fish Audio devolvió HTTP {resp.status_code}.")
    return resp.content


def _edge(texto: str) -> bytes:
    voz = os.environ.get("JARVIS_VOZ", "").strip() or VOZ_EDGE_POR_DEFECTO
    comunicador = edge_tts.Communicate(quitar_emociones(texto), voz, rate="+5%")
    return b"".join(
        chunk["data"] for chunk in comunicador.stream_sync() if chunk["type"] == "audio"
    )


def sintetizar(texto: str) -> bytes:
    """MP3 con `texto` leído por Jarvis y edge-tts como respaldo."""
    texto = en_bolivianos(texto)[:MAX_CARACTERES]
    proveedor = os.environ.get("JARVIS_TTS_PROVIDER", "").strip().lower()
    if not proveedor:
        # Compatibilidad: antes del selector, ElevenLabs se elegía por tener clave.
        proveedor = "elevenlabs" if os.environ.get("ELEVENLABS_API_KEY", "").strip() else "edge"
    if proveedor not in {"fish_audio", "elevenlabs", "edge", "edge-tts"}:
        logger.warning("Proveedor de voz desconocido; uso edge-tts.")
        proveedor = "edge"

    if proveedor == "fish_audio":
        api_key = os.environ.get("FISH_AUDIO_API_KEY", "").strip()
        modelo = os.environ.get("FISH_AUDIO_MODEL", "").strip() or MODELO_FISH_AUDIO_POR_DEFECTO
        voz = os.environ.get("FISH_AUDIO_VOICE_ID", "").strip() or VOZ_FISH_AUDIO_POR_DEFECTO
    elif proveedor == "elevenlabs":
        api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
        modelo = os.environ.get("ELEVENLABS_MODEL", "").strip() or MODELO_ELEVENLABS_POR_DEFECTO
        voz = os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or VOZ_ELEVENLABS_POR_DEFECTO
    else:
        api_key = ""
        modelo = os.environ.get("JARVIS_VOZ", "").strip() or VOZ_EDGE_POR_DEFECTO
        voz = modelo

    # El hash de la clave distingue cuentas sin guardarla en la clave de caché.
    identidad = "|".join((proveedor, modelo, voz, hashlib.sha256(api_key.encode()).hexdigest()))
    clave = "jarvis-voz:" + hashlib.sha256((identidad + "|" + texto).encode()).hexdigest()
    audio = cache.get(clave)
    if audio:
        return audio

    audio = b""
    if api_key and proveedor in {"fish_audio", "elevenlabs"}:
        try:
            audio = _fish_audio(texto, api_key) if proveedor == "fish_audio" else _elevenlabs(texto, api_key)
        except VozError as exc:
            # Créditos agotados, sin red, etc.: Jarvis sigue hablando con edge-tts.
            logger.warning("%s no disponible (%s), uso edge-tts.", proveedor, str(exc))
        except requests.RequestException as exc:
            logger.warning("%s no disponible por error de red (%s), uso edge-tts.", proveedor, type(exc).__name__)
    if not audio:
        try:
            audio = _edge(texto)
        except Exception as exc:  # edge-tts lanza errores de red/servicio variados
            logger.warning("edge-tts no disponible (%s).", type(exc).__name__)
            raise VozError("edge-tts no está disponible.") from exc
    if not audio:
        raise VozError("El servicio de voz no devolvió audio.")
    cache.set(clave, audio, CACHE_SEGUNDOS)
    return audio
