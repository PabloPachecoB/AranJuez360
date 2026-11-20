from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"oficinas/visitas", views.MisVisitasViewSet, basename="mis-visitas-oficina")
router.register(r"mi-oficina/visitas", views.VisitasOficinaViewSet, basename="visitas-oficina")

urlpatterns = [
    path("porteria/invitaciones-hoy/", views.visitas_de_hoy, name="porteria-invitaciones-hoy"),
    path("porteria/invitaciones/<str:codigo>/", views.validar_invitacion, name="porteria-invitacion"),
    path("porteria/invitaciones/<str:codigo>/ingreso/", views.registrar_ingreso, name="porteria-invitacion-ingreso"),
] + router.urls
