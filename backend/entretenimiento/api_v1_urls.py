from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"entretenimiento/peliculas", views.PeliculaPublicaViewSet, basename="peliculas")
router.register(r"entretenimiento/reservas", views.MisReservasViewSet, basename="mis-reservas")
router.register(r"admin/peliculas", views.PeliculasAdminViewSet, basename="admin-peliculas")
router.register(r"admin/funciones", views.FuncionesAdminViewSet, basename="admin-funciones")
router.register(r"admin/eventos", views.EventosAdminViewSet, basename="admin-eventos")

urlpatterns = [
    path("entretenimiento/", views.resumen, name="entretenimiento"),
] + router.urls
