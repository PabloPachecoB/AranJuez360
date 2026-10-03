from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
# App del cliente
router.register(r"puntos/solicitudes", views.MisSolicitudesViewSet, basename="mis-solicitudes")
router.register(r"puntos/movimientos", views.MisMovimientosViewSet, basename="mis-movimientos")
router.register(r"puntos/recompensas", views.RecompensasClienteViewSet, basename="recompensas")
router.register(r"puntos/canjes", views.MisCanjesViewSet, basename="mis-canjes")
# Portería
router.register(r"porteria/visitas", views.PorteriaVisitasViewSet, basename="porteria-visitas")
# Caja del establecimiento
router.register(r"caja/solicitudes", views.CajaSolicitudesViewSet, basename="caja-solicitudes")
# Vista administrativa
router.register(r"admin/solicitudes", views.SolicitudesAdminViewSet, basename="admin-solicitudes")
router.register(r"admin/visitas", views.VisitasAdminViewSet, basename="admin-visitas")
router.register(r"admin/recompensas", views.RecompensasAdminViewSet, basename="admin-recompensas")
router.register(r"admin/puntos-escaneo", views.PuntosEscaneoAdminViewSet, basename="admin-puntos-escaneo")
router.register(r"admin/rangos-compra", views.RangosCompraAdminViewSet, basename="admin-rangos-compra")

urlpatterns = [
    path("puntos/monedero/", views.mi_monedero, name="puntos-monedero"),
    path("puntos/mi-qr/", views.mi_qr, name="puntos-mi-qr"),
    path("puntos/empresa/<str:codigo>/", views.empresa_escaneada, name="puntos-empresa"),
    path("puntos/codigo/<str:codigo>/", views.resolver_codigo, name="puntos-codigo"),
    path("puntos/escanear/", views.escanear, name="puntos-escanear"),
    path("admin/configuracion-puntos/", views.configuracion_puntos, name="admin-configuracion-puntos"),
] + router.urls
