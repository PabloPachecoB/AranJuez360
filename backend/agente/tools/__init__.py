"""Herramientas controladas que conectan el grafo con el dominio del ERP.

Cada tool valida su entrada con un schema Pydantic (schemas.py), ejecuta la
lógica en la capa services.py de la app correspondiente y devuelve un
ToolResult. Registra aquí las tools reales a medida que las crees.
"""

__all__ = []
