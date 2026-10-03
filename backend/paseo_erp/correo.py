"""Backend de correo SMTP que no envía a los dominios de las cuentas de demo.

Las cuentas de `cargar_demo` usan correos inventados (@paseo.bo). Si se les envía
de verdad, Gmail devuelve un rebote "dominio no encontrado" al remitente. Esos
correos se omiten o, si EMAIL_DEMO_REDIRIGIR tiene un correo, se le reenvían a él
(con la cuenta original en el asunto) para poder entrar con las cuentas de demo.
"""

import logging

from django.conf import settings
from django.core.mail.backends.smtp import EmailBackend

logger = logging.getLogger(__name__)


def _es_demo(direccion: str) -> bool:
    dominio = direccion.rsplit("@", 1)[-1].strip(" >").lower()
    return dominio in settings.EMAIL_DOMINIOS_DEMO


class SmtpSinDemoBackend(EmailBackend):
    def send_messages(self, email_messages):
        redirigir = settings.EMAIL_DEMO_REDIRIGIR
        reales = []
        for mensaje in email_messages:
            demo = [d for d in mensaje.to + mensaje.cc + mensaje.bcc if _es_demo(d)]
            mensaje.to = [d for d in mensaje.to if not _es_demo(d)]
            mensaje.cc = [d for d in mensaje.cc if not _es_demo(d)]
            mensaje.bcc = [d for d in mensaje.bcc if not _es_demo(d)]
            if demo and redirigir and not (mensaje.to or mensaje.cc or mensaje.bcc):
                mensaje.to = [redirigir]
                mensaje.subject = f"[Demo: {', '.join(demo)}] {mensaje.subject}"
            elif demo:
                logger.info("Correo no enviado a cuentas de demo: %s", ", ".join(demo))
            if mensaje.to or mensaje.cc or mensaje.bcc:
                reales.append(mensaje)
        if not reales:
            return 0
        return super().send_messages(reales)
