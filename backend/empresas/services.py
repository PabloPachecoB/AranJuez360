"""Lógica de dominio de empresas: alta por invitación del admin, alta directa y código QR/NFC."""

from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape

from usuarios import services as cuentas
from usuarios.models import Usuario

from .models import Empresa, InvitacionEmpresa, _nuevo_codigo_fidelizacion, _nuevo_token_invitacion


def rol_responsable(empresa: Empresa) -> str:
    return Usuario.Rol.OFICINA if empresa.tipo == Empresa.Tipo.OFICINA else Usuario.Rol.NEGOCIO


@transaction.atomic
def crear_empresa_con_acceso(**datos_empresa) -> Empresa:
    """Crea la empresa y su usuario responsable, y le envía las credenciales."""
    empresa = Empresa.objects.create(**datos_empresa)
    cuentas.crear_cuenta_con_acceso(
        empresa.email_contacto, rol_responsable(empresa), empresa.nombre, empresa=empresa
    )
    return empresa


def reenviar_acceso(empresa: Empresa) -> Usuario:
    """Genera una nueva contraseña temporal para el responsable y la reenvía."""
    usuario = empresa.usuarios.get(rol=rol_responsable(empresa))
    return cuentas.reenviar_acceso(usuario, empresa.nombre)


def regenerar_codigo_fidelizacion(empresa: Empresa) -> Empresa:
    """Invalida el QR/NFC actual (p. ej. si se filtró una foto del QR)."""
    empresa.codigo_fidelizacion = _nuevo_codigo_fidelizacion()
    empresa.save(update_fields=["codigo_fidelizacion"])
    return empresa


# --- Alta por invitación -----------------------------------------------------------
# Solo quien recibe la invitación del admin puede crear su cuenta de empresa
# (el autorregistro abierto de la rama reto3-paseoya se descartó a propósito).

DIAS_VIGENCIA_INVITACION = 7
_QUE_HARAS = {
    Empresa.Tipo.NEGOCIO: "registrar tu negocio: ficha, logo, horarios, productos, ofertas y caja de puntos",
    Empresa.Tipo.EMPRENDIMIENTO: "registrar tu emprendimiento: qué vendes, los días que estarás en el Paseo y tu menú",
    Empresa.Tipo.OFICINA: "registrar tu oficina: a qué se dedican, horario de atención, servicios y visitas",
}


class InvitacionError(Exception):
    """La invitación no existe, venció, fue anulada o ya se usó."""


def enlace_invitacion(invitacion: InvitacionEmpresa) -> str:
    return f"{settings.WEB_PANEL_URL.rstrip('/')}/activar/{invitacion.token}"


def _enviar_invitacion(invitacion: InvitacionEmpresa):
    enlace = enlace_invitacion(invitacion)
    if invitacion.empresa:
        que = f"unirte como encargado de {invitacion.empresa.nombre}"
    else:
        que = _QUE_HARAS[invitacion.tipo]
    nombre = invitacion.empresa.nombre if invitacion.empresa else (invitacion.nombre_sugerido or "tu empresa")
    vence = timezone.localtime(invitacion.expira_en)
    nota = f"\n\nMensaje de la administración: {invitacion.mensaje}" if invitacion.mensaje else ""
    send_mail(
        subject=f"Invitación a Paseo Aranjuez 360 · {nombre}",
        message=(
            f"Hola:\n\nLa administración de Paseo Aranjuez te invita a {que}.{nota}\n\n"
            f"Crea tu cuenta aquí: {enlace}\n\nEl enlace vence el {vence:%d/%m/%Y a las %H:%M} y solo se puede usar una vez."
        ),
        html_message=f"""
<div style="font-family:Arial,Helvetica,sans-serif;background:#f7f9ff;padding:24px">
  <div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e8ee">
    <div style="background:#00324b;padding:20px 24px">
      <span style="color:#f6be3b;font-weight:800;font-size:18px">PASEO ARANJUEZ 360</span>
    </div>
    <div style="padding:24px">
      <p style="color:#181c20;font-size:17px;margin:0 0 6px"><b>Te invitamos a {escape(nombre)}</b></p>
      <p style="color:#41474d;font-size:15px;margin:0 0 16px">La administración de Paseo Aranjuez te invita a {escape(que)}.</p>
      {f'<p style="color:#41474d;font-size:14px;background:#f1f4f9;border-radius:10px;padding:12px">{escape(invitacion.mensaje)}</p>' if invitacion.mensaje else ''}
      <p style="text-align:center;margin:24px 0">
        <a href="{enlace}" style="background:#00324b;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:700;display:inline-block">Crear mi cuenta</a>
      </p>
      <p style="color:#72787e;font-size:12px;margin:0">Vence el {vence:%d/%m/%Y a las %H:%M} y solo se puede usar una vez.
      Si no esperabas este correo, ignóralo.</p>
    </div>
  </div>
</div>""",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitacion.email],
    )


@transaction.atomic
def invitar(admin, email: str, tipo: str, nombre_sugerido="", categoria=None, empresa=None, mensaje="") -> InvitacionEmpresa:
    email = email.strip().lower()
    if Usuario.objects.filter(username=email).exists():
        raise InvitacionError("Ya existe una cuenta con ese correo.")
    # Una sola invitación abierta por correo: la anterior queda anulada.
    InvitacionEmpresa.objects.filter(email=email, estado=InvitacionEmpresa.Estado.PENDIENTE).update(
        estado=InvitacionEmpresa.Estado.ANULADA
    )
    invitacion = InvitacionEmpresa.objects.create(
        email=email, tipo=empresa.tipo if empresa else tipo, nombre_sugerido=nombre_sugerido,
        categoria=categoria, empresa=empresa, mensaje=mensaje, creada_por=admin,
        expira_en=timezone.now() + timedelta(days=DIAS_VIGENCIA_INVITACION),
    )
    _enviar_invitacion(invitacion)  # si el correo falla, se revierte la invitación
    return invitacion


@transaction.atomic
def reenviar_invitacion(invitacion: InvitacionEmpresa) -> InvitacionEmpresa:
    if invitacion.estado != InvitacionEmpresa.Estado.PENDIENTE:
        raise InvitacionError("Solo se reenvían invitaciones pendientes.")
    # Nuevo enlace y nueva vigencia: el enlace anterior deja de servir.
    invitacion.token = _nuevo_token_invitacion()
    invitacion.expira_en = timezone.now() + timedelta(days=DIAS_VIGENCIA_INVITACION)
    invitacion.save(update_fields=["token", "expira_en"])
    _enviar_invitacion(invitacion)
    return invitacion


def anular_invitacion(invitacion: InvitacionEmpresa) -> InvitacionEmpresa:
    if invitacion.estado != InvitacionEmpresa.Estado.PENDIENTE:
        raise InvitacionError("Esa invitación ya no está pendiente.")
    invitacion.estado = InvitacionEmpresa.Estado.ANULADA
    invitacion.save(update_fields=["estado"])
    return invitacion


def invitacion_vigente(token: str) -> InvitacionEmpresa:
    invitacion = InvitacionEmpresa.objects.select_related("empresa", "categoria").filter(token=token).first()
    if invitacion is None or invitacion.estado == InvitacionEmpresa.Estado.ANULADA:
        raise InvitacionError("Esta invitación no es válida. Pide una nueva a la administración del Paseo.")
    if invitacion.estado == InvitacionEmpresa.Estado.ACEPTADA:
        raise InvitacionError("Esta invitación ya se usó. Inicia sesión con tu correo y contraseña.")
    if invitacion.expira_en <= timezone.now():
        raise InvitacionError("Esta invitación venció. Pide a la administración que te la reenvíe.")
    return invitacion


@transaction.atomic
def aceptar_invitacion(token: str, nombre_empresa: str, first_name: str, last_name: str, password: str) -> Usuario:
    """Crea la empresa (o se une a la existente) y la cuenta del responsable con su propia contraseña.

    El correo queda verificado: el enlace solo pudo llegar a esa casilla.
    """
    invitacion = invitacion_vigente(token)
    invitacion = InvitacionEmpresa.objects.select_for_update().get(pk=invitacion.pk)
    if invitacion.estado != InvitacionEmpresa.Estado.PENDIENTE:
        raise InvitacionError("Esta invitación ya se usó.")
    if Usuario.objects.filter(username=invitacion.email).exists():
        raise InvitacionError("Ya existe una cuenta con este correo. Inicia sesión.")

    empresa = invitacion.empresa
    if empresa is None:
        empresa = Empresa.objects.create(
            nombre=nombre_empresa.strip() or invitacion.nombre_sugerido, tipo=invitacion.tipo,
            categoria=invitacion.categoria, email_contacto=invitacion.email,
        )
    usuario = Usuario(
        username=invitacion.email, email=invitacion.email, first_name=first_name.strip(),
        last_name=last_name.strip(), rol=rol_responsable(empresa), empresa=empresa,
        email_verificado=True, debe_cambiar_password=False,
    )
    usuario.set_password(password)
    usuario.save()

    invitacion.estado = InvitacionEmpresa.Estado.ACEPTADA
    invitacion.aceptada_por = usuario
    invitacion.aceptada_en = timezone.now()
    if invitacion.empresa is None:
        invitacion.empresa = empresa
    invitacion.save(update_fields=["estado", "aceptada_por", "aceptada_en", "empresa"])
    return usuario
