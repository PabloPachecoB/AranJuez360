from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"entretenimiento/peliculas", views.PeliculaPublicaViewSet, basename="peliculas")
router.register(r"entretenimiento/reservas", views.MisReservasViewSet, basename="mis-reservas")
router.register(r"admin/peliculas", views.PeliculasAdminViewSet, basename="admin-peliculas")
router.register(r"admin/funciones", views.FuncionesAdminViewSet, basename="admin-funciones")
router.register(r"admin/eventos", views.EventosAdminViewSet, basename="admin-eventos")
# Escenario abierto
router.register(r"entretenimiento/espacios", views.EspaciosViewSet, basename="espacios")
router.register(r"entretenimiento/propuestas", views.MisPropuestasViewSet, basename="mis-propuestas")
router.register(r"entretenimiento/entradas", views.MisEntradasViewSet, basename="mis-entradas-evento")
router.register(r"admin/espacios", views.EspaciosAdminViewSet, basename="admin-espacios")
router.register(r"admin/propuestas", views.PropuestasAdminViewSet, basename="admin-propuestas")

urlpatterns = [
    path("entretenimiento/", views.resumen, name="entretenimiento"),
    path("porteria/entradas-evento/<str:codigo>/", views.entrada_evento, name="porteria-entrada-evento"),
] + router.urls
