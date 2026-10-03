"""Enrutado central de la API v1. Cada app expone su propio api_v1_urls."""

from django.urls import include, path

urlpatterns = [
    path("", include("usuarios.api_v1_urls")),
    path("", include("empresas.api_v1_urls")),
    path("", include("fidelizacion.api_v1_urls")),
    path("admin/reportes/", include("reportes.api_v1_urls")),
    path("agente/", include("agente.api_v1_urls")),
]
