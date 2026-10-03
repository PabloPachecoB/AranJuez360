from rest_framework.routers import DefaultRouter

from .api import AgentActionViewSet

router = DefaultRouter()
router.register(r"acciones", AgentActionViewSet, basename="agent-actions")

urlpatterns = router.urls
