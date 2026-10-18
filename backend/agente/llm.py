"""Adaptador del LLM: aísla al grafo del proveedor concreto.

Patrón portado de TorreSegura. Usa un cliente compatible con la API de OpenAI
(sirve para Ollama local y para endpoints cloud como Qwen/DashScope). La
configuración viene validada desde config.LLMSettings.
"""

import base64
import json
from functools import lru_cache
from typing import Dict, List

from openai import OpenAI, OpenAIError

from .config import LLMSettings


MAX_TITULO_CARACTERES = 120
MAX_TITULO_ENTRADA = 800


class LLMError(Exception):
    """El proveedor LLM falló o no está disponible."""


class LLMAdapter:
    def __init__(self, settings: LLMSettings):
        self.settings = settings
        self._client = OpenAI(
            base_url=settings.base_url,
            # Ollama no valida la key, pero el cliente exige una.
            api_key=settings.api_key or "ollama",
            timeout=settings.timeout_seconds,
        )

    @property
    def soporta_audio(self) -> bool:
        return bool(self.settings.audio_model)

    def complete(self, system: str, user: str) -> str:
        """Devuelve la respuesta del modelo para un par (system, user)."""
        return self.chat(system, [{"role": "user", "content": user}])

    def chat(self, system: str, messages: List[Dict[str, str]]) -> str:
        """Respuesta del modelo a un historial [{role, content}, ...]."""
        try:
            response = self._client.chat.completions.create(
                model=self.settings.model,
                messages=[{"role": "system", "content": system}, *messages],
                temperature=self.settings.temperature,
                max_tokens=self.settings.max_tokens,
                # Qwen3 en DashScope: sin "thinking" la respuesta es más rápida.
                extra_body={"enable_thinking": False},
            )
        except OpenAIError as exc:
            raise LLMError(str(exc)) from exc
        return (response.choices[0].message.content or "").strip()

    def chat_con_herramientas(self, system: str, messages: List[Dict[str, str]], tools: list):
        """Como `chat`, pero el modelo puede pedir una herramienta.

        Devuelve (texto, [(nombre, argumentos_dict), ...]).
        """
        try:
            response = self._client.chat.completions.create(
                model=self.settings.model,
                messages=[{"role": "system", "content": system}, *messages],
                temperature=self.settings.temperature,
                max_tokens=self.settings.max_tokens,
                tools=tools,
                extra_body={"enable_thinking": False},
            )
        except OpenAIError as exc:
            raise LLMError(str(exc)) from exc
        mensaje = response.choices[0].message
        llamadas = []
        for llamada in mensaje.tool_calls or []:
            try:
                argumentos = json.loads(llamada.function.arguments or "{}")
            except json.JSONDecodeError:
                argumentos = {}
            llamadas.append((llamada.function.name, argumentos))
        return (mensaje.content or "").strip(), llamadas

    @staticmethod
    def _limpiar_titulo(titulo: str) -> str:
        """Normaliza la salida breve del modelo y respeta el campo Django."""
        limpio = " ".join((titulo or "").split())
        limpio = limpio.strip(" \t\r\n\"'“”‘’«»")
        if limpio.lower().startswith(("título:", "titulo:")):
            limpio = limpio.split(":", 1)[1].strip()
        limpio = limpio[:MAX_TITULO_CARACTERES].rstrip()
        return limpio if any(caracter.isalnum() for caracter in limpio) else ""

    def generar_titulo(self, mensaje_usuario: str, respuesta_asistente: str) -> str:
        """Genera un título breve sin cambiar el modelo del chat principal."""
        limite_por_turno = MAX_TITULO_ENTRADA // 2
        contexto = (
            f"Mensaje inicial del usuario:\n{(mensaje_usuario or '').strip()[:limite_por_turno]}\n\n"
            f"Respuesta de Jarvis:\n{(respuesta_asistente or '').strip()[:limite_por_turno]}"
        )[:MAX_TITULO_ENTRADA]
        system = (
            "Genera un título breve y descriptivo para una conversación. "
            "Usa el idioma de la conversación, idealmente de 3 a 6 palabras. "
            "Describe solo el tema central, no inventes datos y devuelve únicamente el título, sin comillas ni explicación."
        )
        try:
            response = self._client.chat.completions.create(
                model=self.settings.title_model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": contexto},
                ],
                temperature=0,
                max_tokens=32,
                extra_body={"enable_thinking": False},
            )
        except OpenAIError as exc:
            raise LLMError(str(exc)) from exc
        return self._limpiar_titulo(response.choices[0].message.content or "")

    def transcribe(self, audio: bytes, formato: str) -> str:
        """Transcribe una nota de voz con el modelo multimodal (Qwen Omni).

        `formato` es la extensión del archivo: m4a, aac, mp3, wav, webm...
        Los modelos Omni de DashScope solo responden en streaming.
        """
        if not self.soporta_audio:
            raise LLMError("No hay un modelo de audio configurado (QWEN_AUDIO_MODEL).")
        data_uri = f"data:audio/{formato};base64,{base64.b64encode(audio).decode()}"
        try:
            stream = self._client.chat.completions.create(
                model=self.settings.audio_model,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "input_audio", "input_audio": {"data": data_uri, "format": formato}},
                        {"type": "text", "text": (
                            "Transcribe literalmente este audio en su idioma original. "
                            "Responde solo con la transcripción, sin comentarios."
                        )},
                    ],
                }],
                stream=True,
            )
            texto = "".join(
                chunk.choices[0].delta.content or "" for chunk in stream if chunk.choices
            )
        except OpenAIError as exc:
            raise LLMError(str(exc)) from exc
        return texto.strip()


@lru_cache(maxsize=1)
def get_llm_adapter() -> LLMAdapter:
    return LLMAdapter(LLMSettings.from_env())
