from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
# App del cliente
router.register(r"puntos/solicitudes", views.MisSolicitudesViewSet, basename="mis-solicitudes")
router.register(r"puntos/movimientos", views.MisMovimientosViewSet, basename="mis-movimientos")
# Portería
router.register(r"porteria/visitas", views.PorteriaVisitasViewSet, basename="porteria-visitas")
# Caja del establecimiento
router.register(r"caja/solicitudes", views.CajaSolicitudesViewSet, basename="caja-solicitudes")
# Vista administrativa
router.register(r"admin/solicitudes", views.SolicitudesAdminViewSet, basename="admin-solicitudes")
router.register(r"admin/visitas", views.VisitasAdminViewSet, basename="admin-visitas")

urlpatterns = [
    path("puntos/mi-qr/", views.mi_qr, name="puntos-mi-qr"),
    path("puntos/empresa/<str:codigo>/", views.empresa_escaneada, name="puntos-empresa"),
    path("admin/configuracion-puntos/", views.configuracion_puntos, name="admin-configuracion-puntos"),
] + router.urls
