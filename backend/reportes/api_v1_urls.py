from django.urls import path

from . import views

urlpatterns = [
    path("clientes/mapa/", views.mapa_clientes, name="reporte-mapa-clientes"),
    path("resumen/", views.resumen, name="reporte-resumen"),
    path("usuarios-por-rol/", views.usuarios_por_rol, name="reporte-usuarios-por-rol"),
    path("visitas-por-dia/", views.visitas_por_dia, name="reporte-visitas-por-dia"),
    path("compras-por-dia/", views.compras_por_dia, name="reporte-compras-por-dia"),
    path("horas-pico/", views.horas_pico, name="reporte-horas-pico"),
    path("dias-semana/", views.dias_semana, name="reporte-dias-semana"),
    path("empresas/ranking/", views.ranking_empresas, name="reporte-ranking-empresas"),
    path("empresas/sin-actividad/", views.empresas_sin_actividad, name="reporte-empresas-sin-actividad"),
    path("clientes/frecuentes/", views.clientes_frecuentes, name="reporte-clientes-frecuentes"),
    path("clientes/dormidos/", views.clientes_dormidos, name="reporte-clientes-dormidos"),
    path("clientes/procedencia/", views.clientes_por_procedencia, name="reporte-clientes-procedencia"),
    path("clientes/perfil/", views.perfil_clientes, name="reporte-perfil-clientes"),
    path("auditoria/", views.auditoria, name="reporte-auditoria"),
    path("clientes/procedencia-por-dia/", views.volumen_por_procedencia, name="reporte-procedencia-por-dia"),
    path("clientes/<int:pk>/historial/", views.historial_cliente, name="reporte-historial-cliente"),
]
