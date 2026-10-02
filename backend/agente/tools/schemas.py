"""Esquemas tipados de entrada/salida para las tools del agente.

Base portada de TorreSegura. Define un schema por acción que el agente pueda
ejecutar; `extra="forbid"` evita que el modelo invente campos.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict


class ToolResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    status: str
    error_code: Optional[str] = None
    message: str = ""


# TODO: un schema por acción, p. ej.:
# class RegistrarPagoRequest(BaseModel):
#     model_config = ConfigDict(extra="forbid")
#     contrato_id: int = Field(gt=0)
#     monto: float = Field(gt=0)
