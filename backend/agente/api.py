"""API del agente: chat + revisar/confirmar/rechazar acciones propuestas.

Patrón portado de TorreSegura. El usuario solo ve y actúa sobre SUS acciones.
Las acciones sensibles exigen reautenticación (la contraseña nunca entra al
estado conversacional ni al checkpoint).
"""

import re

from django.http import HttpResponse
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from datetime import timedelta

from django.utils import timezone
from empresas.models import Empresa
from empresas.rubros import normalizar
from fidelizacion.services import ReglaNegocioError

from . import herramientas
from .agent import get_conversation_service
from .llm import LLMError, get_llm_adapter
from .models import AgentAction
from .serializers import (
    AgentActionSerializer,
    AgentChatRequestSerializer,
    AgentVozRequestSerializer,
)
from .voz import MAX_CARACTERES, VozError, quitar_emociones, sintetizar

# Prefijos de tipo_accion que requieren reautenticar al confirmar.
ACCIONES_SENSIBLES = ()  # p. ej. ("PAGO_", "ANULACION_")
VIGENCIA_PROPUESTA_MIN = 15
MAX_FICHAS = 4


def _empresas_mencionadas(request, texto: str) -> list:
    """Fichas (con logo) de los establecimientos que Jarvis nombró, para mostrarlas bajo su globo."""
    texto = normalizar(texto or "")
    fichas = []
    for empresa in Empresa.objects.filter(activo=True).select_related("categoria"):
        # "Patanegra, cocina española" también cuenta si Jarvis solo dice "Patanegra".
        nombre = normalizar(empresa.nombre.split(",")[0])
        hallado = re.search(rf"\b{re.escape(nombre)}\b", texto) if len(nombre) >= 3 else None
        if not hallado:  # \b evita que "Tigo" coincida dentro de "contigo"
            continue
        fichas.append((hallado.start(), {
            "id": empresa.id, "nombre": empresa.nombre, "piso": empresa.piso, "local": empresa.local,
            "categoria_nombre": empresa.categoria.nombre if empresa.categoria else None,
            "logo": request.build_absolute_uri(empresa.logo.url) if empresa.logo else None,
        }))
    return [ficha for _, ficha in sorted(fichas, key=lambda par: par[0])][:MAX_FICHAS]


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
        return Response({**result, "empresas": _empresas_mencionadas(request, result.get("text"))})

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def voz(self, request):
        """Nota de voz: transcribe con el modelo de audio y responde como `chat`."""
        serializer = AgentVozRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        audio = data["audio"]
        try:
            adapter = get_llm_adapter()
            transcripcion = adapter.transcribe(audio.read(), audio.formato)
        except (LLMError, ValueError):
            return Response(
                {"detail": "No pude escuchar la nota de voz. Intenta de nuevo o escribe tu pregunta."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not transcripcion:
            return Response(
                {"detail": "No se escuchó nada en el audio. Intenta hablar más cerca del micrófono."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        thread_id = data.get("thread_id") or f"user-{request.user.id}"
        result = get_conversation_service().chat(request.user, thread_id, transcripcion)
        return Response({**result, "transcripcion": transcripcion,
                         "empresas": _empresas_mencionadas(request, result.get("text"))})

    @action(detail=False, methods=["get"])
    def hablar(self, request):
        """MP3 con la voz de Jarvis leyendo `?texto=` (la app lo reproduce)."""
        texto = request.query_params.get("texto", "").strip()
        if not texto or len(texto) > MAX_CARACTERES:
            return Response(
                {"detail": f"Envía un texto de 1 a {MAX_CARACTERES} caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            audio = sintetizar(texto)
        except VozError:
            return Response(
                {"detail": "La voz de Jarvis no está disponible ahora."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        response = HttpResponse(audio, content_type="audio/mpeg")
        response["Cache-Control"] = "private, max-age=3600"
        return response

    @action(detail=True, methods=["post"])
    def confirmar(self, request, pk=None):
        """El usuario tocó "Confirmar": recién aquí se ejecuta la acción que propuso Jarvis."""
        accion = self.get_object()
        if accion.estado != AgentAction.Estado.PENDIENTE:
            return Response({"detail": "Esta acción ya no está pendiente."}, status=status.HTTP_400_BAD_REQUEST)
        if timezone.now() - accion.fecha_creacion > timedelta(minutes=VIGENCIA_PROPUESTA_MIN):
            accion.estado = AgentAction.Estado.RECHAZADA
            accion.save(update_fields=["estado"])
            return Response(
                {"detail": "La propuesta venció. Pídesela de nuevo a Jarvis."}, status=status.HTTP_400_BAD_REQUEST
            )
        if accion.tipo_accion.startswith(ACCIONES_SENSIBLES):
            password = request.data.get("password", "")
            if not password or not request.user.check_password(password):
                return Response(
                    {"error": "Confirmación reforzada: contraseña inválida."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        try:
            texto, resultado = herramientas.ejecutar(accion.tipo_accion, request.user, accion.payload)
        except ReglaNegocioError as exc:
            accion.estado = AgentAction.Estado.RECHAZADA
            accion.resultado = {"error": str(exc)}
            accion.save(update_fields=["estado", "resultado"])
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        accion.estado = AgentAction.Estado.EJECUTADA
        accion.resultado = resultado
        accion.save(update_fields=["estado", "resultado"])
        return Response({"text": quitar_emociones(texto), "voz": texto, "resultado": resultado})

    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        accion = self.get_object()
        accion.estado = AgentAction.Estado.RECHAZADA
        accion.save(update_fields=["estado"])
        return Response({"status": "rechazada"})
