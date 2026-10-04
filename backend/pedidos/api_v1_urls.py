from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
# Cliente
router.register(r"pedidos", views.MisPedidosViewSet, basename="mis-pedidos")
router.register(r"admin/pedidos", views.PedidosAdminViewSet, basename="admin-pedidos")
# Panel del negocio
router.register(r"mi-empresa/pedidos", views.MisPedidosEmpresaViewSet, basename="mi-empresa-pedidos")

urlpatterns = router.urls
