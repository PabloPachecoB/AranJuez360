"""Cuentas creadas por el admin (negocios, oficinas, porteros) con credenciales por correo."""

import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from .models import Usuario

_DESCRIPCION_ROL = {
    Usuario.Rol.NEGOCIO: (
        "completar la ficha de tu establecimiento (logo, ubicación, horarios, productos "
        "y ofertas) y atender las solicitudes de puntos de tus clientes"
    ),
    Usuario.Rol.OFICINA: "completar la ficha de tu oficina (logo, ubicación, horarios y servicios)",
    Usuario.Rol.PORTERO: "registrar las visitas de los clientes en la entrada del Paseo",
}


def _password_temporal():
    return secrets.token_urlsafe(9)


def _enviar_credenciales(usuario: Usuario, nombre: str, password: str):
    send_mail(
        subject="Tu acceso a Paseo Aranjuez 360",
        message=(
            f"Hola, {nombre}:\n\n"
            "La administración de Paseo Aranjuez creó tu cuenta para "
            f"{_DESCRIPCION_ROL.get(usuario.rol, 'usar la plataforma')}.\n\n"
            f"Ingresa en: {settings.WEB_PANEL_URL}\n"
            f"Usuario: {usuario.username}\n"
            f"Contraseña temporal: {password}\n\n"
            "Por seguridad, el sistema te pedirá cambiar la contraseña en tu primer ingreso.\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[usuario.email],
    )


@transaction.atomic
def crear_cuenta_con_acceso(email: str, rol: str, nombre: str, **campos) -> Usuario:
    """Crea la cuenta con contraseña temporal y la envía por correo.

    Debe llamarse dentro de la misma transacción que crea los datos asociados:
    si el correo falla, se revierte todo.
    """
    email = email.lower()
    password = _password_temporal()
    usuario = Usuario(username=email, email=email, rol=rol, debe_cambiar_password=True, **campos)
    usuario.set_password(password)
    usuario.save()
    _enviar_credenciales(usuario, nombre, password)
    return usuario


@transaction.atomic
def reenviar_acceso(usuario: Usuario, nombre: str) -> Usuario:
    password = _password_temporal()
    usuario.set_password(password)
    usuario.debe_cambiar_password = True
    usuario.save(update_fields=["password", "debe_cambiar_password"])
    _enviar_credenciales(usuario, nombre, password)
    return usuario
