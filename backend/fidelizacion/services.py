"""Lógica de Paseo Points: visitas registradas por portería y compras aprobadas en caja."""

from decimal import ROUND_DOWN, Decimal

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from empresas.models import Empresa
from usuarios.models import Usuario

from .models import ConfiguracionPuntos, MovimientoPuntos, SolicitudPuntos, Visita

_QR_SALT = "fidelizacion.qr-cliente"


class ReglaNegocioError(Exception):
    """Error de validación de dominio que se devuelve al cliente como 400."""


def empresa_por_codigo(codigo: str) -> Empresa:
    try:
        return Empresa.objects.exclude(tipo=Empresa.Tipo.OFICINA).get(
            codigo_fidelizacion=codigo, activo=True
        )
    except Empresa.DoesNotExist:
        raise ReglaNegocioError("Código no válido o establecimiento inactivo.")


def calcular_puntos(monto, config: ConfiguracionPuntos) -> int:
    return int((monto * config.puntos_por_boliviano).quantize(Decimal("1"), rounding=ROUND_DOWN))


@transaction.atomic
def crear_solicitud(cliente: Usuario, codigo: str, nit: str, monto) -> SolicitudPuntos:
    empresa = empresa_por_codigo(codigo)
    # Serializa las solicitudes del mismo cliente para que los límites no se salten en paralelo.
    Usuario.objects.select_for_update().filter(pk=cliente.pk).first()
    config = ConfiguracionPuntos.actual()

    if monto <= 0:
        raise ReglaNegocioError("El monto debe ser mayor a 0.")
    if monto > config.monto_maximo_solicitud:
        raise ReglaNegocioError(
            f"El monto supera el máximo permitido (Bs {config.monto_maximo_solicitud})."
        )

    previas = SolicitudPuntos.objects.filter(cliente=cliente, empresa=empresa)
    if previas.filter(estado=SolicitudPuntos.Estado.PENDIENTE).exists():
        raise ReglaNegocioError("Ya tienes una solicitud pendiente en este establecimiento.")
    hoy = timezone.localdate()
    if previas.filter(creado_en__date=hoy).count() >= config.solicitudes_diarias_por_empresa:
        raise ReglaNegocioError("Alcanzaste el límite de solicitudes de hoy en este establecimiento.")

    return SolicitudPuntos.objects.create(cliente=cliente, empresa=empresa, nit=nit, monto=monto)


def _bloquear_pendiente(solicitud_id: int, cajero: Usuario) -> SolicitudPuntos:
    solicitud = (
        SolicitudPuntos.objects.select_for_update()
        .filter(pk=solicitud_id, empresa_id=cajero.empresa_id)
        .first()
    )
    if solicitud is None:
        raise SolicitudPuntos.DoesNotExist
    if solicitud.estado != SolicitudPuntos.Estado.PENDIENTE:
        raise ReglaNegocioError("La solicitud ya fue atendida.")
    return solicitud


@transaction.atomic
def aprobar_solicitud(solicitud_id: int, cajero: Usuario) -> SolicitudPuntos:
    """Caja verificó el ticket: acredita los puntos una sola vez."""
    solicitud = _bloquear_pendiente(solicitud_id, cajero)
    puntos = calcular_puntos(solicitud.monto, ConfiguracionPuntos.actual())

    solicitud.estado = SolicitudPuntos.Estado.APROBADA
    solicitud.puntos = puntos
    solicitud.atendida_por = cajero
    solicitud.atendida_en = timezone.now()
    solicitud.save(update_fields=["estado", "puntos", "atendida_por", "atendida_en"])

    MovimientoPuntos.objects.create(
        cliente_id=solicitud.cliente_id,
        empresa_id=solicitud.empresa_id,
        solicitud=solicitud,
        puntos=puntos,
        tipo=MovimientoPuntos.Tipo.COMPRA,
        descripcion=f"Compra de Bs {solicitud.monto}",
    )
    Usuario.objects.filter(pk=solicitud.cliente_id).update(puntos_saldo=F("puntos_saldo") + puntos)
    return solicitud


@transaction.atomic
def rechazar_solicitud(solicitud_id: int, cajero: Usuario, motivo: str = "") -> SolicitudPuntos:
    solicitud = _bloquear_pendiente(solicitud_id, cajero)
    solicitud.estado = SolicitudPuntos.Estado.RECHAZADA
    solicitud.atendida_por = cajero
    solicitud.atendida_en = timezone.now()
    solicitud.motivo_rechazo = motivo
    solicitud.save(update_fields=["estado", "atendida_por", "atendida_en", "motivo_rechazo"])
    return solicitud


# --- Visitas (portería) ---------------------------------------------------------

def generar_qr_cliente(cliente: Usuario) -> dict:
    """QR personal dinámico: firmado y con vencimiento corto, para que una captura
    enviada a otra persona no sirva para sumar visitas sin estar en el Paseo."""
    token = signing.TimestampSigner(salt=_QR_SALT).sign(str(cliente.pk))
    return {"token": token, "vigencia_segundos": settings.QR_CLIENTE_VIGENCIA_SEGUNDOS}


def cliente_por_qr(token: str) -> Usuario:
    try:
        pk = signing.TimestampSigner(salt=_QR_SALT).unsign(
            token, max_age=settings.QR_CLIENTE_VIGENCIA_SEGUNDOS
        )
    except signing.SignatureExpired:
        raise ReglaNegocioError("El QR venció. Pide al cliente que lo actualice en su app.")
    except signing.BadSignature:
        raise ReglaNegocioError("QR no válido.")
    cliente = Usuario.objects.filter(pk=pk, rol=Usuario.Rol.CLIENTE, is_active=True).first()
    if cliente is None:
        raise ReglaNegocioError("QR no válido.")
    return cliente


@transaction.atomic
def registrar_visita(token: str, portero: Usuario) -> Visita:
    """El portero escanea el QR del cliente: se registra el ingreso y, si no superó
    el cupo diario, se acreditan los puntos de visita."""
    cliente = cliente_por_qr(token)
    cliente = Usuario.objects.select_for_update().get(pk=cliente.pk)
    config = ConfiguracionPuntos.actual()

    con_puntos_hoy = Visita.objects.filter(
        cliente=cliente, creado_en__date=timezone.localdate(), puntos__gt=0
    ).count()
    puntos = config.puntos_por_visita if con_puntos_hoy < config.visitas_con_puntos_por_dia else 0

    visita = Visita.objects.create(cliente=cliente, portero=portero, puntos=puntos)
    if puntos:
        MovimientoPuntos.objects.create(
            cliente=cliente,
            visita=visita,
            puntos=puntos,
            tipo=MovimientoPuntos.Tipo.VISITA,
            descripcion="Visita al Paseo",
        )
        Usuario.objects.filter(pk=cliente.pk).update(puntos_saldo=F("puntos_saldo") + puntos)
    return visita
