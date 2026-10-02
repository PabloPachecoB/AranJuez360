"""Códigos de 6 dígitos por correo: verificación de correo y segundo factor de login.

- Solo se guarda un HMAC del código (nunca el código en claro).
- Vencen a los CODIGO_VERIFICACION_MINUTOS y admiten CODIGO_VERIFICACION_INTENTOS intentos.
- Reenviar un código invalida los anteriores del mismo propósito.
"""

import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import CodigoVerificacion, Usuario

REENVIO_ESPERA_SEGUNDOS = 60


class CodigoError(Exception):
    """Error de verificación que se devuelve al cliente como 400."""


def _hash(codigo: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), codigo.encode(), hashlib.sha256).hexdigest()


def _enviar(usuario: Usuario, codigo: str, proposito: str):
    if proposito == CodigoVerificacion.Proposito.VERIFICAR_EMAIL:
        asunto = "Verifica tu correo - Paseo Aranjuez 360"
        intro = "Usa este código para verificar tu correo y activar tu cuenta:"
    else:
        asunto = "Tu código de acceso - Paseo Aranjuez 360"
        intro = "Usa este código para terminar de iniciar sesión:"
    send_mail(
        subject=asunto,
        message=(
            f"Hola, {usuario.first_name or usuario.username}:\n\n{intro}\n\n    {codigo}\n\n"
            f"Vence en {settings.CODIGO_VERIFICACION_MINUTOS} minutos. "
            "Si no fuiste tú, ignora este correo y cambia tu contraseña.\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[usuario.email],
    )


@transaction.atomic
def emitir_codigo(usuario: Usuario, proposito: str) -> CodigoVerificacion:
    usuario.codigos.filter(proposito=proposito, usado=False).update(usado=True)
    codigo = f"{secrets.randbelow(1_000_000):06d}"
    registro = CodigoVerificacion.objects.create(
        usuario=usuario,
        proposito=proposito,
        codigo_hash=_hash(codigo),
        expira_en=timezone.now() + timedelta(minutes=settings.CODIGO_VERIFICACION_MINUTOS),
    )
    _enviar(usuario, codigo, proposito)
    return registro


def _pendiente(desafio) -> CodigoVerificacion:
    registro = (
        CodigoVerificacion.objects.select_for_update()
        .select_related("usuario")
        .filter(desafio=desafio, usado=False)
        .first()
    )
    if registro is None or not registro.usuario.is_active:
        raise CodigoError("El código ya no es válido. Solicita uno nuevo.")
    return registro


@transaction.atomic
def reenviar_codigo(desafio) -> CodigoVerificacion:
    registro = _pendiente(desafio)
    espera = (registro.creado_en + timedelta(seconds=REENVIO_ESPERA_SEGUNDOS)) - timezone.now()
    if espera.total_seconds() > 0:
        raise CodigoError(f"Espera {int(espera.total_seconds()) + 1} segundos para pedir otro código.")
    return emitir_codigo(registro.usuario, registro.proposito)


def verificar_codigo(desafio, codigo: str) -> Usuario:
    """Valida el código. Si es correcto lo consume y marca el correo como verificado
    (recibir el código prueba que el usuario controla ese correo)."""
    with transaction.atomic():
        registro = _pendiente(desafio)
        if registro.expira_en < timezone.now():
            registro.usado = True
            registro.save(update_fields=["usado"])
            raise CodigoError("El código venció. Solicita uno nuevo.")

        if not hmac.compare_digest(registro.codigo_hash, _hash(codigo)):
            registro.intentos += 1
            agotado = registro.intentos >= settings.CODIGO_VERIFICACION_INTENTOS
            registro.usado = agotado
            registro.save(update_fields=["intentos", "usado"])
            if agotado:
                mensaje = "Demasiados intentos. Solicita un código nuevo."
            else:
                restantes = settings.CODIGO_VERIFICACION_INTENTOS - registro.intentos
                mensaje = f"Código incorrecto. Te quedan {restantes} intento(s)."
            # El intento fallido debe quedar guardado: se lanza fuera del atomic.
            error = CodigoError(mensaje)
        else:
            error = None
            registro.usado = True
            registro.save(update_fields=["usado"])
            usuario = registro.usuario
            if not usuario.email_verificado:
                usuario.email_verificado = True
                usuario.save(update_fields=["email_verificado"])
    if error:
        raise error
    return usuario
