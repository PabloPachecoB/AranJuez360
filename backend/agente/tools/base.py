"""Clase base para las tools del agente."""

from dataclasses import dataclass


@dataclass
class ToolContext:
    """Contexto autenticado que toda tool recibe (nunca confía en el LLM)."""

    user: object


class BaseTool:
    name: str = "base"

    def __init__(self, context: ToolContext):
        self.context = context

    def run(self, payload):  # -> ToolResult
        raise NotImplementedError
