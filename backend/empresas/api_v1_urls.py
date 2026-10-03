from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
# Vista administrativa
router.register(r"admin/empresas", views.EmpresaAdminViewSet, basename="admin-empresas")
router.register(r"admin/categorias", views.CategoriaAdminViewSet, basename="admin-categorias")
router.register(r"admin/invitaciones-empresa", views.InvitacionesEmpresaAdminViewSet, basename="admin-invitaciones-empresa")
# Panel de la empresa
router.register(r"mi-empresa/productos", views.MisProductosViewSet, basename="mis-productos")
router.register(r"mi-empresa/ofertas", views.MisOfertasViewSet, basename="mis-ofertas")
router.register(r"mi-empresa/fotos", views.MisFotosViewSet, basename="mis-fotos")
# Público (app y web)
router.register(r"empresas", views.EmpresaPublicaViewSet, basename="empresas")
router.register(r"categorias", views.CategoriaPublicaViewSet, basename="categorias")
router.register(r"ofertas", views.OfertaPublicaViewSet, basename="ofertas")

mi_empresa = views.MiEmpresaViewSet

urlpatterns = [
    path("auth/registro-negocio/", views.registro_negocio, name="registro-negocio"),
    path("auth/invitacion-empresa/<str:token>/", views.invitacion_empresa, name="invitacion-empresa"),
    path("mi-empresa/", mi_empresa.as_view({"get": "perfil", "patch": "perfil"}), name="mi-empresa"),
    path("mi-empresa/horarios/", mi_empresa.as_view({"get": "horarios", "put": "horarios"}), name="mi-empresa-horarios"),
    path("mi-empresa/codigo/", mi_empresa.as_view({"get": "codigo"}), name="mi-empresa-codigo"),
    path(
        "mi-empresa/codigo/regenerar/",
        mi_empresa.as_view({"post": "regenerar_codigo"}),
        name="mi-empresa-codigo-regenerar",
    ),
] + router.urls
