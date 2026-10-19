"""API del agente: chat + revisar/confirmar/rechazar acciones propuestas.

Patrón portado de TorreSegura. El usuario solo ve y actúa sobre SUS acciones.
Las acciones sensibles exigen reautenticación (la contraseña nunca entra al
estado conversacional ni al checkpoint).
"""

import re
from uuid import UUID

from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from datetime import timedelta

from django.utils import timezone
from empresas.models import Empresa, Producto
from empresas.rubros import normalizar
from fidelizacion.services import ReglaNegocioError

from . import herramientas
from .agent import get_conversation_service
from .llm import LLMError, get_llm_adapter
from .models import AgentAction, ConversacionJarvis, MensajeJarvis
from .serializers import (
    AgentActionSerializer,
    AgentChatRequestSerializer,
    AgentVozRequestSerializer,
    ConversacionJarvisCreateSerializer,
    ConversacionJarvisDetailSerializer,
    ConversacionJarvisListSerializer,
    MensajeJarvisSerializer,
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
            "id": empresa.id, "nombre": empresa.nombre, "piso": empresa.piso,
            "categoria_nombre": empresa.categoria.nombre if empresa.categoria else None,
            "logo": request.build_absolute_uri(empresa.logo.url) if empresa.logo else None,
        }))
    return [ficha for _, ficha in sorted(fichas, key=lambda par: par[0])][:MAX_FICHAS]


MAX_PLATOS_FICHA = 4


def _productos_mencionados(request, texto: str) -> list:
    """Platos que Jarvis nombró (con su foto y local) para mostrarlos como tarjetas bajo su globo.

    Cada plato se asigna al local mencionado MÁS CERCANO en la frase, así "capuchino de Café Aranjuez" no
    se confunde con el capuchino de otro café, y un plato sin su local cerca no se muestra.
    """
    texto = normalizar(texto or "")
    if not texto:
        return []
    productos = list(Producto.objects.filter(
        activo=True, empresa__activo=True, empresa__categoria__nombre="Comida"
    ).select_related("empresa"))
    # Dónde se nombra cada local en el texto.
    posiciones = {}
    for empresa in {p.empresa for p in productos}:
        nombre = normalizar(empresa.nombre.split(",")[0])
        if len(nombre) >= 3:
            posiciones[empresa.id] = [m.start() for m in re.finditer(rf"\b{re.escape(nombre)}\b", texto)]
    fichas = []
    for producto in productos:
        nombre = normalizar(producto.nombre)
        if len(nombre) < 4 or not posiciones.get(producto.empresa_id):
            continue
        for plato in re.finditer(rf"\b{re.escape(nombre)}\b", texto):
            # (distancia, local) del local nombrado más cerca de este plato
            cercano = min(
                (abs(plato.start() - pos), empresa_id)
                for empresa_id, lugares in posiciones.items() for pos in lugares
            )
            if cercano[1] == producto.empresa_id and cercano[0] <= 160:
                imagen = producto.foto or producto.empresa.logo
                precio = producto.precio_promocion if producto.en_promocion and producto.precio_promocion else producto.precio
                fichas.append((plato.start(), {
                    "id": producto.id, "nombre": producto.nombre, "precio": str(precio),
                    "empresa_id": producto.empresa_id, "empresa_nombre": producto.empresa.nombre,
                    "piso": producto.empresa.piso,
                    "foto": request.build_absolute_uri(imagen.url) if imagen else None,
                }))
                break
    return [ficha for _, ficha in sorted(fichas, key=lambda par: par[0])][:MAX_PLATOS_FICHA]


def _persistir_tarjetas_jarvis(conversacion, resultado: dict, empresas: list, productos: list) -> None:
    """Guarda solamente tarjetas públicas en el turno de Jarvis recién creado."""
    mensaje_id = resultado.pop("_mensaje_asistente_id", None)
    if not mensaje_id:
        return
    mensaje = MensajeJarvis.objects.filter(
        pk=mensaje_id,
        conversacion=conversacion,
        rol=MensajeJarvis.Rol.ASISTENTE,
    ).first()
    if not mensaje:
        return
    metadatos = dict(mensaje.metadatos or {})
    metadatos["empresas"] = empresas
    metadatos["productos"] = productos
    mensaje.metadatos = metadatos
    mensaje.save(update_fields=["metadatos"])


class ConversacionJarvisViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Historial de Jarvis del usuario autenticado.

    Las conversaciones archivadas se ocultan y se comportan como inexistentes.
    El borrado de la API es lógico: conserva mensajes para auditoría.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ConversacionJarvis.objects.filter(
            usuario=self.request.user,
            archivada_en__isnull=True,
        )

    def get_serializer_class(self):
        if self.action == "create":
            return ConversacionJarvisCreateSerializer
        if self.action == "list":
            return ConversacionJarvisListSerializer
        return ConversacionJarvisDetailSerializer

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            ConversacionJarvisDetailSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        # El archivado y el rechazo de propuestas pendientes forman una sola
        # operación de auditoría; no contiene ninguna invocación al LLM.
        with transaction.atomic():
            conversacion = self.get_object()
            ahora = timezone.now()
            archivadas = ConversacionJarvis.objects.filter(
                pk=conversacion.pk,
                usuario=request.user,
                archivada_en__isnull=True,
            ).update(archivada_en=ahora, actualizada_en=ahora)
            if not archivadas:
                raise Http404
            AgentAction.objects.filter(
                conversacion=conversacion,
                estado=AgentAction.Estado.PENDIENTE,
            ).update(estado=AgentAction.Estado.RECHAZADA)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def mensajes(self, request, pk=None):
        conversacion = self.get_object()
        mensajes = conversacion.mensajes.order_by("creado_en", "id")
        return Response(MensajeJarvisSerializer(mensajes, many=True).data)


class AgentActionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    serializer_class = AgentActionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AgentAction.objects.filter(usuario=self.request.user).select_related("conversacion")
        conversation_id = self.request.query_params.get("conversation_id")
        if conversation_id is not None:
            try:
                conversation_id = UUID(conversation_id)
            except (TypeError, ValueError, AttributeError) as exc:
                raise ValidationError({"conversation_id": "Debe ser un UUID válido."}) from exc
            # El queryset ya está aislado por usuario: un UUID ajeno no revela
            # su existencia y simplemente devuelve una lista vacía.
            queryset = queryset.filter(conversacion_id=conversation_id)
        return queryset

    @action(detail=False, methods=["post"])
    def chat(self, request):
        serializer = AgentChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        conversation_id = data.get("conversation_id")
        if conversation_id:
            conversacion = get_object_or_404(
                ConversacionJarvis,
                pk=conversation_id,
                usuario=request.user,
                archivada_en__isnull=True,
            )
        else:
            conversacion = ConversacionJarvis.objects.create(usuario=request.user)
        try:
            result = get_conversation_service().chat(
                request.user, conversacion, data["message"]
            )
        except ValueError as exc:
            # Una conversación archivada entre la consulta y el servicio se
            # comporta como inexistente, igual que en el resto de la API.
            raise Http404 from exc
        empresas = _empresas_mencionadas(request, result.get("text"))
        productos = _productos_mencionados(request, result.get("text"))
        _persistir_tarjetas_jarvis(conversacion, result, empresas, productos)
        return Response({**result, "conversation_id": conversacion.id,
                         "empresas": empresas, "productos": productos})

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
        conversation_id = data.get("conversation_id")
        if conversation_id:
            conversacion = get_object_or_404(
                ConversacionJarvis,
                pk=conversation_id,
                usuario=request.user,
                archivada_en__isnull=True,
            )
        else:
            conversacion = ConversacionJarvis.objects.create(usuario=request.user)
        try:
            result = get_conversation_service().chat(
                request.user,
                conversacion,
                transcripcion,
                origen=MensajeJarvis.Origen.VOZ,
            )
        except ValueError as exc:
            raise Http404 from exc
        empresas = _empresas_mencionadas(request, result.get("text"))
        productos = _productos_mencionados(request, result.get("text"))
        _persistir_tarjetas_jarvis(conversacion, result, empresas, productos)
        return Response({**result, "conversation_id": conversacion.id, "transcripcion": transcripcion,
                         "empresas": empresas, "productos": productos})

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
        if accion.conversacion_id:
            conversacion = accion.conversacion
            if conversacion.usuario_id != request.user.id:
                raise Http404
            if conversacion.archivada_en is not None:
                accion.estado = AgentAction.Estado.RECHAZADA
                accion.save(update_fields=["estado"])
                return Response(
                    {"detail": "La conversación fue archivada; la propuesta fue rechazada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
        texto_visible = quitar_emociones(texto)
        # La herramienta ya terminó: solo se abre una transacción breve para
        # dejar juntos el resultado de la acción y su mensaje auditable.
        with transaction.atomic():
            accion.estado = AgentAction.Estado.EJECUTADA
            accion.resultado = resultado
            accion.save(update_fields=["estado", "resultado"])
            if accion.conversacion_id:
                conversacion = accion.conversacion
                MensajeJarvis.objects.create(
                    conversacion=conversacion,
                    rol=MensajeJarvis.Rol.ASISTENTE,
                    contenido=texto_visible,
                    origen=MensajeJarvis.Origen.TEXTO,
                )
                ConversacionJarvis.objects.filter(
                    pk=conversacion.pk,
                    archivada_en__isnull=True,
                ).update(actualizada_en=timezone.now())
        return Response({"text": texto_visible, "voz": texto, "resultado": resultado})

    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        accion = self.get_object()
        if accion.estado != AgentAction.Estado.PENDIENTE:
            return Response({"detail": "Esta acción ya no está pendiente."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            accion.estado = AgentAction.Estado.RECHAZADA
            accion.save(update_fields=["estado"])
            if accion.conversacion_id and accion.conversacion.archivada_en is None:
                MensajeJarvis.objects.create(
                    conversacion=accion.conversacion,
                    rol=MensajeJarvis.Rol.ASISTENTE,
                    contenido="Listo, no realicé esa acción.",
                    origen=MensajeJarvis.Origen.TEXTO,
                )
                ConversacionJarvis.objects.filter(
                    pk=accion.conversacion_id,
                    archivada_en__isnull=True,
                ).update(actualizada_en=timezone.now())
        return Response({"status": "rechazada"})
