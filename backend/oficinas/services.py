"""Reglas de las visitas a oficinas: solicitar, aprobar/invitar y registrar el ingreso."""

import re
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from empresas.models import Empresa
from fidelizacion.services import ReglaNegocioError
from usuarios.models import Usuario

from .models import Invitacion

DIAS_ANTICIPACION = 60
PENDIENTES_POR_OFICINA = 3


def oficina_activa(oficina_id) -> Empresa:
    oficina = Empresa.objects.filter(pk=oficina_id, tipo=Empresa.Tipo.OFICINA, activo=True).first()
    if oficina is None:
        raise ReglaNegocioError("Esa oficina no existe o no está atendiendo.")
    return oficina


def _validar_fecha(fecha):
    hoy = timezone.localdate()
    if fecha < hoy:
        raise ReglaNegocioError("La fecha de la visita ya pasó.")
    if fecha > hoy + timedelta(days=DIAS_ANTICIPACION):
        raise ReglaNegocioError(f"Solo puedes agendar con hasta {DIAS_ANTICIPACION} días de anticipación.")


def qr_contenido(invitacion: Invitacion) -> str:
    """Lo que codifica el QR: lo lee el escáner del portero en la app."""
    return f"paseo360://inv/{invitacion.codigo}"


def enlace_publico(invitacion: Invitacion) -> str:
    """Página con el QR para quien no tiene la app (se comparte por WhatsApp)."""
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}/invitacion/{invitacion.codigo}/"


def whatsapp_url(invitacion: Invitacion):
    numero = re.sub(r"\D", "", invitacion.visitante_celular or "")
    if not numero:
        return None
    if len(numero) == 8:  # celular boliviano sin código de país
        numero = f"591{numero}"
    hora = f" a las {invitacion.hora:%H:%M}" if invitacion.hora else ""
    texto = (
        f"Hola {invitacion.visitante_nombre}, {invitacion.oficina.nombre} te invita al Paseo Aranjuez "
        f"el {invitacion.fecha:%d/%m/%Y}{hora}. Muestra este QR en portería: {enlace_publico(invitacion)} "
        f"(código {invitacion.codigo})"
    )
    return f"https://wa.me/{numero}?text={quote(texto)}"


# --- Cliente (app) ---------------------------------------------------------------

@transaction.atomic
def solicitar(cliente: Usuario, oficina_id, fecha, hora=None, motivo="") -> Invitacion:
    oficina = oficina_activa(oficina_id)
    _validar_fecha(fecha)
    pendientes = Invitacion.objects.filter(cliente=cliente, oficina=oficina, estado=Invitacion.Estado.PENDIENTE)
    if pendientes.count() >= PENDIENTES_POR_OFICINA:
        raise ReglaNegocioError("Ya tienes solicitudes pendientes con esta oficina. Espera su respuesta.")
    return Invitacion.objects.create(
        oficina=oficina, cliente=cliente, visitante_nombre=cliente.get_full_name() or cliente.username,
        visitante_ci=getattr(cliente, "ci", "") or "", visitante_celular=getattr(cliente, "celular", "") or "",
        fecha=fecha, hora=hora, motivo=motivo, origen=Invitacion.Origen.SOLICITUD,
    )


@transaction.atomic
def cancelar(cliente: Usuario, invitacion_id) -> Invitacion:
    inv = Invitacion.objects.select_for_update().filter(pk=invitacion_id, cliente=cliente).first()
    if inv is None:
        raise ReglaNegocioError("No encontramos esa visita.")
    if inv.estado not in (Invitacion.Estado.PENDIENTE, Invitacion.Estado.APROBADA):
        raise ReglaNegocioError("Esa visita ya no se puede cancelar.")
    inv.estado = Invitacion.Estado.CANCELADA
    inv.save(update_fields=["estado"])
    return inv


# --- Oficina (panel web) -----------------------------------------------------------

def _de_mi_oficina(usuario: Usuario, invitacion_id) -> Invitacion:
    inv = (
        Invitacion.objects.select_for_update().select_related("oficina")
        .filter(pk=invitacion_id, oficina_id=usuario.empresa_id).first()
    )
    if inv is None:
        raise ReglaNegocioError("No encontramos esa solicitud.")
    if inv.estado != Invitacion.Estado.PENDIENTE:
        raise ReglaNegocioError("Esa solicitud ya fue respondida.")
    return inv


@transaction.atomic
def aprobar(usuario: Usuario, invitacion_id) -> Invitacion:
    inv = _de_mi_oficina(usuario, invitacion_id)
    inv.estado = Invitacion.Estado.APROBADA
    inv.respondida_en = timezone.now()
    inv.save(update_fields=["estado", "respondida_en"])
    return inv


@transaction.atomic
def rechazar(usuario: Usuario, invitacion_id, motivo="") -> Invitacion:
    inv = _de_mi_oficina(usuario, invitacion_id)
    inv.estado = Invitacion.Estado.RECHAZADA
    inv.motivo_rechazo = motivo
    inv.respondida_en = timezone.now()
    inv.save(update_fields=["estado", "motivo_rechazo", "respondida_en"])
    return inv


def _buscar_cliente(identificador: str):
    identificador = (identificador or "").strip()
    if not identificador:
        return None
    return (
        Usuario.objects.filter(rol=Usuario.Rol.CLIENTE, is_active=True)
        .filter(email__iexact=identificador).first()
        or Usuario.objects.filter(rol=Usuario.Rol.CLIENTE, is_active=True, ci=identificador).first()
    )


@transaction.atomic
def invitar(usuario: Usuario, datos: dict) -> Invitacion:
    """La oficina invita: a un cliente con la app (por correo o CI) o a alguien sin app (nombre + celular)."""
    oficina = oficina_activa(usuario.empresa_id)
    _validar_fecha(datos["fecha"])
    cliente = _buscar_cliente(datos.get("cliente"))
    if datos.get("cliente") and cliente is None:
        raise ReglaNegocioError("No hay un cliente con ese correo o CI en la app. Invítalo con nombre y celular.")
    if cliente:
        nombre = cliente.get_full_name() or cliente.username
        ci, celular = getattr(cliente, "ci", "") or "", getattr(cliente, "celular", "") or ""
    else:
        nombre = (datos.get("visitante_nombre") or "").strip()
        ci, celular = datos.get("visitante_ci", ""), datos.get("visitante_celular", "")
        if not nombre:
            raise ReglaNegocioError("Escribe el nombre del invitado.")
        if not celular:
            raise ReglaNegocioError("Sin app, el invitado necesita un celular para recibir su QR por WhatsApp.")
    return Invitacion.objects.create(
        oficina=oficina, cliente=cliente, visitante_nombre=nombre, visitante_ci=ci, visitante_celular=celular,
        fecha=datos["fecha"], hora=datos.get("hora"), motivo=datos.get("motivo", ""),
        origen=Invitacion.Origen.INVITACION, estado=Invitacion.Estado.APROBADA, respondida_en=timezone.now(),
    )


# --- Portería (app modo portero) -----------------------------------------------------

def validar(codigo: str) -> Invitacion:
    """Lo que ve el portero al escanear: debe estar aprobada y ser para hoy."""
    inv = Invitacion.objects.select_related("oficina", "cliente").filter(codigo=(codigo or "").upper()).first()
    if inv is None:
        raise ReglaNegocioError("Invitación no válida.")
    if inv.estado == Invitacion.Estado.USADA:
        raise ReglaNegocioError(f"Esta invitación ya se usó ({timezone.localtime(inv.ingreso_en):%d/%m %H:%M}).")
    if inv.estado != Invitacion.Estado.APROBADA:
        raise ReglaNegocioError(f"Esta invitación está {inv.get_estado_display().lower()}.")
    if inv.fecha != timezone.localdate():
        raise ReglaNegocioError(f"Esta invitación es para el {inv.fecha:%d/%m/%Y}, no para hoy.")
    return inv


@transaction.atomic
def registrar_ingreso(codigo: str, portero: Usuario) -> Invitacion:
    inv = validar(codigo)
    inv = Invitacion.objects.select_for_update().get(pk=inv.pk)
    if inv.estado != Invitacion.Estado.APROBADA:  # otro portero la registró en paralelo
        raise ReglaNegocioError("Esta invitación ya se usó.")
    inv.estado = Invitacion.Estado.USADA
    inv.ingreso_en = timezone.now()
    inv.portero = portero
    inv.save(update_fields=["estado", "ingreso_en", "portero"])
    return inv
