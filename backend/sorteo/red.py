"""IP del cliente y límites de peticiones del Sorteo Paseo.

Se lee solo de la cabecera que fija nuestro proxy (`SORTEO_IP_HEADER`, p. ej. X-Client-IP) y nunca de
`X-Forwarded-For`, que un visitante puede inventar. Sin esa cabecera se usa la dirección de la conexión.
El contador vive en una caché de archivos compartida por los workers de gunicorn.
"""

import hashlib
import hmac
import ipaddress
import logging

from django.conf import settings
from django.core.cache import caches
from rest_framework.throttling import ScopedRateThrottle

logger = logging.getLogger(__name__)

_avisado = False


def ip_cliente(request) -> str:
    global _avisado
    remota = request.META.get("REMOTE_ADDR", "") or ""
    cabecera = settings.SORTEO_IP_HEADER
    if not cabecera:
        return remota
    clave = "HTTP_" + cabecera.upper().replace("-", "_")
    valor = (request.META.get(clave, "") or "").strip()
    try:
        return str(ipaddress.ip_address(valor))
    except ValueError:  # ausente o sin resolver (p. ej. «{client_ip}» literal): no se confía
        if not _avisado:  # una sola vez por proceso, para no llenar el log
            _avisado = True
            logger.warning(
                "SORTEO_IP_HEADER=%s está configurado pero la petición no trae una IP válida (%r): los límites por IP "
                "usarán la dirección de la conexión (la del proxy). Revisa web/Caddyfile.", cabecera, valor,
            )
        return remota


def hash_ip(ip: str) -> str:
    """Huella de la IP para los topes por contacto: no se guarda la dirección."""
    if not ip:
        return ""
    return hmac.new(settings.SECRET_KEY.encode(), f"ip:{ip}".encode(), hashlib.sha256).hexdigest()


class LimiteSorteo(ScopedRateThrottle):
    """Límite por IP (o por usuario si está autenticado), contado entre todos los workers."""

    cache = caches["sorteo_throttle"]

    def get_ident(self, request):
        return ip_cliente(request)
