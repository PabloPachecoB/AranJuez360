from rest_framework.routers import DefaultRouter
from django.urls import path

from .api import AgentActionViewSet, ConversacionJarvisViewSet
from . import analisis, recepcion

router = DefaultRouter()
router.register(r"acciones", AgentActionViewSet, basename="agent-actions")
router.register(r"conversaciones", ConversacionJarvisViewSet, basename="agent-conversaciones")

urlpatterns = router.urls + [
    path("admin/analisis/chat/", analisis.chat),
    path("recepcion/contexto/", recepcion.contexto),
    path("recepcion/chat/", recepcion.conversar),
    path("recepcion/transcribir/", recepcion.transcribir),
    path("recepcion/qr/", recepcion.verificar_qr),
]
