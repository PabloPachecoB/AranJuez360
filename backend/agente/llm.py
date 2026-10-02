"""Adaptador del LLM: aísla al grafo del proveedor concreto.

Patrón portado de TorreSegura. Usa un cliente compatible con la API de OpenAI
(sirve para Ollama local y para endpoints cloud como Qwen). La configuración
viene validada desde config.LLMSettings.
"""

from functools import lru_cache

from .config import LLMSettings


class LLMAdapter:
    def __init__(self, settings: LLMSettings):
        self.settings = settings

    def complete(self, system: str, user: str) -> str:
        """Devuelve la respuesta del modelo para un par (system, user).

        TODO: instanciar el cliente (p. ej. `openai.OpenAI(base_url=...,
        api_key=...)`) y llamar a chat.completions con self.settings.
        """
        raise NotImplementedError("Conecta aquí tu proveedor LLM.")


@lru_cache(maxsize=1)
def get_llm_adapter() -> LLMAdapter:
    return LLMAdapter(LLMSettings.from_env())
