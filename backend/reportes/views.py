"""Endpoints del dashboard administrativo. Todos aceptan ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
(por defecto, los últimos 30 días)."""

from datetime import date, timedelta

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from usuarios.models import Usuario
from usuarios.permissions import EsAdmin

from . import auditoria as auditoria_modulo
from . import services
from .geografia import mapa_clientes as obtener_mapa_clientes


@api_view(["GET"])
@permission_classes([EsAdmin])
def mapa_clientes(request):
    return Response(obtener_mapa_clientes(*_periodo(request)))


def _fecha(request, nombre: str, defecto: date) -> date:
    valor = request.query_params.get(nombre)
    if not valor:
        return defecto
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValidationError({nombre: "Formato de fecha inválido (usa YYYY-MM-DD)."})


def _periodo(request) -> tuple[date, date]:
    hasta = _fecha(request, "hasta", timezone.localdate())
    desde = _fecha(request, "desde", hasta - timedelta(days=29))
    if desde > hasta:
        raise ValidationError({"desde": "La fecha inicial no puede ser posterior a la final."})
    return desde, hasta


def _entero(request, nombre: str, defecto: int) -> int:
    try:
        return max(1, int(request.query_params.get(nombre, defecto)))
    except ValueError:
        raise ValidationError({nombre: "Debe ser un número entero."})


@api_view(["GET"])
@permission_classes([EsAdmin])
def resumen(request):
    return Response(services.resumen(*_periodo(request)))


@api_view(["GET"])
@permission_classes([EsAdmin])
def usuarios_por_rol(request):
    filas = (
        Usuario.objects.values("rol")
        .annotate(
            total=Count("id"),
            activos=Count("id", filter=Q(is_active=True)),
            sin_activar=Count("id", filter=Q(debe_cambiar_password=True)),
        )
        .order_by("rol")
    )
    return Response(list(filas))


@api_view(["GET"])
@permission_classes([EsAdmin])
def visitas_por_dia(request):
    return Response(services.visitas_por_dia(*_periodo(request), request.query_params.get("procedencia")))


@api_view(["GET"])
@permission_classes([EsAdmin])
def compras_por_dia(request):
    return Response(services.compras_por_dia(*_periodo(request), request.query_params.get("procedencia")))


@api_view(["GET"])
@permission_classes([EsAdmin])
def horas_pico(request):
    return Response(services.horas_pico(*_periodo(request)))


@api_view(["GET"])
@permission_classes([EsAdmin])
def dias_semana(request):
    return Response(services.dias_semana(*_periodo(request)))


@api_view(["GET"])
@permission_classes([EsAdmin])
def ranking_empresas(request):
    tipo = request.query_params.get("tipo")
    return Response(services.ranking_empresas(*_periodo(request), tipo=tipo))


@api_view(["GET"])
@permission_classes([EsAdmin])
def empresas_sin_actividad(request):
    return Response(services.empresas_sin_actividad(_entero(request, "dias", 30)))


@api_view(["GET"])
@permission_classes([EsAdmin])
def clientes_frecuentes(request):
    orden = request.query_params.get("orden", "visitas")
    return Response(services.clientes_frecuentes(
        *_periodo(request), orden=orden, limite=_entero(request, "limite", 20),
        procedencia=request.query_params.get("procedencia"),
    ))


@api_view(["GET"])
@permission_classes([EsAdmin])
def clientes_por_procedencia(request):
    """De dónde son los clientes: cantidad, compras, monto, visitas y monedas por procedencia."""
    return Response(services.clientes_por_procedencia(*_periodo(request)))


@api_view(["GET"])
@permission_classes([EsAdmin])
def perfil_clientes(request):
    """Clientes por rango de edad y por ocupación (estudiante, universitario, profesional...)."""
    return Response(services.perfil_clientes(*_periodo(request)))


@api_view(["GET"])
@permission_classes([EsAdmin])
def auditoria(request):
    """Línea de tiempo de la actividad del Paseo: ?tipo=PEDIDO|COMPRA|CANJE|VISITA|ESCENARIO|INVITACION|USUARIO."""
    tipo = (request.query_params.get("tipo") or "").upper() or None
    if tipo and tipo not in auditoria_modulo.TIPOS:
        return Response({"detail": "Tipo de evento no válido."}, status=400)
    return Response({
        "tipos": [{"valor": k, "nombre": v} for k, v in auditoria_modulo.TIPOS.items()],
        "eventos": auditoria_modulo.eventos(tipo=tipo),
    })


@api_view(["GET"])
@permission_classes([EsAdmin])
def volumen_por_procedencia(request):
    """Compras por día y procedencia."""
    return Response(services.volumen_diario_por_procedencia(*_periodo(request)))


@api_view(["GET"])
@permission_classes([EsAdmin])
def clientes_dormidos(request):
    return Response(services.clientes_dormidos(_entero(request, "dias", 30)))


@api_view(["GET"])
@permission_classes([EsAdmin])
def historial_cliente(request, pk):
    cliente = get_object_or_404(Usuario, pk=pk, rol=Usuario.Rol.CLIENTE)
    return Response(services.historial_cliente(cliente))
