from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"admin/porteros", views.PorteroAdminViewSet, basename="admin-porteros")
router.register(r"admin/usuarios", views.UsuarioAdminViewSet, basename="admin-usuarios")

urlpatterns = [
    path("auth/registro/", views.registro, name="registro"),
    path("auth/login/", views.login, name="login"),
    path("auth/verificar-codigo/", views.verificar_codigo, name="verificar-codigo"),
    path("auth/reenviar-codigo/", views.reenviar_codigo, name="reenviar-codigo"),
    path("auth/yo/", views.yo, name="yo"),
    path("auth/cambiar-password/", views.cambiar_password, name="cambiar-password"),
] + router.urls
