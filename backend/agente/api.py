"""API del agente: chat + revisar/confirmar/rechazar acciones propuestas.

Patrón portado de TorreSegura. El usuario solo ve y actúa sobre SUS acciones.
Las acciones sensibles exigen reautenticación (la contraseña nunca entra al
estado conversacional ni al checkpoint).
"""

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .agent import get_conversation_service
from .models import AgentAction
from .serializers import AgentActionSerializer, AgentChatRequestSerializer

# Prefijos de tipo_accion que requieren reautenticar al confirmar.
ACCIONES_SENSIBLES = ()  # p. ej. ("PAGO_", "ANULACION_")


class AgentActionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = AgentActionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AgentAction.objects.filter(usuario=self.request.user)

    @action(detail=False, methods=["post"])
    def chat(self, request):
        serializer = AgentChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        thread_id = data.get("thread_id") or f"user-{request.user.id}"
        result = get_conversation_service().chat(
            request.user, thread_id, data["message"]
        )
        return Response(result)

    @action(detail=True, methods=["post"])
    def confirmar(self, request, pk=None):
        accion = self.get_object()
        if accion.tipo_accion.startswith(ACCIONES_SENSIBLES):
            password = request.data.get("password", "")
            if not password or not request.user.check_password(password):
                return Response(
                    {"error": "Confirmación reforzada: contraseña inválida."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        result = get_conversation_service().resume_confirmation(request.user, accion)
        accion.estado = AgentAction.Estado.CONFIRMADA
        accion.save(update_fields=["estado"])
        return Response(result)

    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        accion = self.get_object()
        accion.estado = AgentAction.Estado.RECHAZADA
        accion.save(update_fields=["estado"])
        return Response({"status": "rechazada"})
