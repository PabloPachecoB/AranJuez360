"""Entrada del grafo para `langgraph dev` / Agent Server."""

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "paseo_erp.settings")

import django

django.setup()

from agente.agent.graph import build_agent_graph

# En desarrollo, el Agent Server administra el checkpointer.
graph = build_agent_graph(checkpointer=None)
