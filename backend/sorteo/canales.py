"""Envío del código de 6 dígitos por correo o por celular.

El celular es enchufable: `SORTEO_CANAL_CELULAR` vale `ninguno` (sin proveedor: no se ofrece), `consola`
(desarrollo: el código sale en la terminal del backend) o, más adelante, el proveedor que se elija.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils.html import escape

from .errores import SorteoError
from .models import DesafioContacto

logger = logging.getLogger(__name__)

CANAL_CELULAR_CONSOLA = "consola"
CANAL_CELULAR_NINGUNO = "ninguno"


def canales_disponibles() -> list[str]:
    canales = [DesafioContacto.Canal.CORREO.value]
    if settings.SORTEO_CANAL_CELULAR != CANAL_CELULAR_NINGUNO:
        canales.append(DesafioContacto.Canal.CELULAR.value)
    return canales


def exigir_canal(canal: str) -> None:
    if canal not in canales_disponibles():
        raise SorteoError(
            "canal_no_disponible",
            "Por ahora, solo por correo." if canal == DesafioContacto.Canal.CELULAR
            else "Esa opción no está disponible.",
        )


def enmascarar(canal: str, destino: str) -> str:
    """Muestra solo lo justo para que la persona reconozca su contacto."""
    if canal == DesafioContacto.Canal.CORREO:
        usuario, _, dominio = destino.partition("@")
        return f"{usuario[:1]}{'•' * 4}@{dominio}"
    # Un número de otro país conserva su prefijo a la vista (+54••••••89) para que la persona lo reconozca.
    if destino.startswith("+"):
        return f"{destino[:3]}{'•' * 6}{destino[-2:]}"
    return f"{'•' * 6}{destino[-2:]}"


def _html(nombre: str, intro: str, codigo: str) -> str:
    return f"""
<div style="font-family:Arial,Helvetica,sans-serif;background:#f7f9ff;padding:24px">
  <div style="max-width:440px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e8ee">
    <div style="background:#00324b;padding:20px 24px">
      <span style="color:#f6be3b;font-weight:800;font-size:18px">PASEO ARANJUEZ 360</span>
    </div>
    <div style="padding:24px">
      <p style="color:#181c20;font-size:16px;margin:0 0 8px">Hola, <b>{escape(nombre)}</b>:</p>
      <p style="color:#41474d;font-size:15px;margin:0 0 20px">{escape(intro)}</p>
      <div style="background:#f1f4f9;border-radius:12px;padding:18px;text-align:center;
                  font-size:34px;letter-spacing:10px;font-weight:800;color:#00324b">{codigo}</div>
      <p style="color:#72787e;font-size:13px;margin:20px 0 0">
        Vale {settings.CODIGO_VERIFICACION_MINUTOS} minutos. Si no lo pediste, ignora este mensaje.
      </p>
    </div>
  </div>
</div>"""


def enviar_codigo(canal: str, destino: str, nombre: str, codigo: str, proposito: str) -> None:
    intro = (
        "Tu código para activar tu tarjeta del Sorteo Paseo:"
        if proposito == DesafioContacto.Proposito.REGISTRO
        else "Tu código para entrar a tu tarjeta del Sorteo Paseo:"
    )
    if canal == DesafioContacto.Canal.CORREO:
        try:
            send_mail(
                subject="Tu código - Sorteo Paseo Aranjuez",
                message=(
                    f"Hola, {nombre or 'cliente'}:\n\n{intro}\n\n    {codigo}\n\n"
                    f"Vale {settings.CODIGO_VERIFICACION_MINUTOS} minutos. Si no lo pediste, ignora este mensaje.\n"
                ),
                html_message=_html(nombre or "cliente", intro, codigo),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[destino],
            )
        except Exception as exc:  # SMTP caído, credenciales, red: el cliente debe poder reintentar
            logger.exception("No se pudo enviar el código del sorteo por correo")
            raise SorteoError(
                "envio_fallido", "No pudimos enviar el código. Prueba en unos minutos.", 503,
            ) from exc
        from paseo_erp.correo import _es_demo

        if settings.DEBUG or (_es_demo(destino) and settings.CODIGOS_DEMO_EN_LOG):
            print(f"\n===== CÓDIGO DEL SORTEO para {destino}: {codigo} =====\n", flush=True)
        return
    if settings.SORTEO_CANAL_CELULAR == CANAL_CELULAR_CONSOLA:
        print(f"\n===== CÓDIGO DEL SORTEO (celular {destino}): {codigo} =====\n", flush=True)
        return
    # Proveedor real aún sin implementar: no se debería haber ofrecido el canal.
    logger.error("Canal de celular '%s' sin implementar", settings.SORTEO_CANAL_CELULAR)
    raise SorteoError("canal_no_disponible", "Por ahora, solo por correo.")
