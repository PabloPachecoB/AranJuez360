import base64
import io

import qrcode
from django.http import Http404
from django.shortcuts import render
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from fidelizacion.services import ReglaNegocioError
from usuarios.permissions import EsCliente, EsOficina, EsPortero

from . import services
from .models import Invitacion
from .serializers import (
    InvitacionOficinaSerializer,
    InvitacionSerializer,
    InvitarSerializer,
    RechazoSerializer,
    SolicitarSerializer,
)


def _regla(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ReglaNegocioError as exc:
        raise ValidationError({"detail": str(exc)})


# --- Cliente: solicitar y ver sus visitas --------------------------------------------

class MisVisitasViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = InvitacionSerializer
    permission_classes = [EsCliente]

    def get_queryset(self):
        return Invitacion.objects.filter(cliente=self.request.user).select_related("oficina")

    def create(self, request):
        datos = SolicitarSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        d = datos.validated_data
        inv = _regla(services.solicitar, request.user, d["oficina"], d["fecha"], d.get("hora"), d.get("motivo", ""))
        return Response(InvitacionSerializer(inv).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        return Response(InvitacionSerializer(_regla(services.cancelar, request.user, pk)).data)


# --- Oficina: bandeja de solicitudes e invitaciones -------------------------------------

class VisitasOficinaViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = InvitacionOficinaSerializer
    permission_classes = [EsOficina]

    def get_queryset(self):
        qs = Invitacion.objects.filter(oficina_id=self.request.user.empresa_id).select_related("oficina")
        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado.upper())
        if self.request.query_params.get("desde") == "hoy":
            qs = qs.filter(fecha__gte=timezone.localdate())
        return qs

    def create(self, request):
        datos = InvitarSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        inv = _regla(services.invitar, request.user, datos.validated_data)
        return Response(InvitacionOficinaSerializer(inv).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        return Response(InvitacionOficinaSerializer(_regla(services.aprobar, request.user, pk)).data)

    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        datos = RechazoSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        inv = _regla(services.rechazar, request.user, pk, datos.validated_data.get("motivo", ""))
        return Response(InvitacionOficinaSerializer(inv).data)


# --- Portería: validar QR y registrar ingreso -------------------------------------------

@api_view(["GET"])
@permission_classes([EsPortero])
def validar_invitacion(request, codigo):
    return Response(InvitacionSerializer(_regla(services.validar, codigo)).data)


@api_view(["POST"])
@permission_classes([EsPortero])
def registrar_ingreso(request, codigo):
    inv = _regla(services.registrar_ingreso, codigo, request.user)
    data = InvitacionSerializer(inv).data
    data["mensaje"] = f"Ingreso registrado: {inv.visitante_nombre} → {inv.oficina.nombre}."
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([EsPortero])
def visitas_de_hoy(request):
    """Lista de quienes vienen hoy a las oficinas (para el portero)."""
    qs = Invitacion.objects.filter(
        fecha=timezone.localdate(), estado__in=[Invitacion.Estado.APROBADA, Invitacion.Estado.USADA]
    ).select_related("oficina").order_by("hora")
    return Response(InvitacionSerializer(qs, many=True).data)


# --- Página pública con el QR (para quien no tiene la app; se comparte por WhatsApp) ----

def invitacion_publica(request, codigo):
    inv = Invitacion.objects.select_related("oficina").filter(codigo=codigo.upper()).first()
    if inv is None or inv.estado not in (Invitacion.Estado.APROBADA, Invitacion.Estado.USADA):
        raise Http404("Invitación no encontrada")
    imagen = qrcode.make(services.qr_contenido(inv), box_size=10, border=2)
    buffer = io.BytesIO()
    imagen.save(buffer, format="PNG")
    return render(request, "oficinas/invitacion.html", {
        "inv": inv, "qr": base64.b64encode(buffer.getvalue()).decode(),
    })
