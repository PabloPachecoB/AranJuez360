"""Sesión del titular de una tarjeta.

No es un `Usuario` ni lleva rol: es un token firmado con el id de la cuenta y su `version_sesion`. Recuperar la
cuenta sube esa versión y deja sin efecto las sesiones anteriores. Solo se declara en las vistas del titular,
así que nunca sirve para los paneles de admin, negocio o caja.
"""

from django.conf import settings
from django.core import signing
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .errores import SorteoError
from .models import CuentaFidelizacion

SAL = "sorteo.sesion"
ESQUEMA = "Tarjeta"


def emitir_sesion(cuenta: CuentaFidelizacion) -> str:
    return signing.dumps({"c": cuenta.pk, "v": cuenta.version_sesion}, salt=SAL)


def _cuenta_de_token(token: str) -> CuentaFidelizacion | None:
    """La cuenta del token si la firma, el vencimiento y la versión de sesión son válidos (sea cual sea su estado)."""
    try:
        datos = signing.loads(token, salt=SAL, max_age=settings.SORTEO_SESION_DIAS * 86400)
        cuenta = CuentaFidelizacion.objects.get(pk=datos["c"])
    except (signing.BadSignature, KeyError, TypeError, CuentaFidelizacion.DoesNotExist):
        return None
    return cuenta if cuenta.version_sesion == datos["v"] else None


def cuenta_de_sesion(token: str) -> CuentaFidelizacion | None:
    cuenta = _cuenta_de_token(token)
    return cuenta if cuenta is not None and cuenta.estado == CuentaFidelizacion.Estado.ACTIVA else None


class TitularTarjeta:
    """Lo que ve DRF como `request.user` en las vistas del titular."""

    is_authenticated = True
    is_anonymous = False
    is_active = True
    rol = None
    empresa_id = None

    def __init__(self, cuenta: CuentaFidelizacion):
        self.cuenta = cuenta


class SesionTarjeta(BaseAuthentication):
    """Cabecera `Authorization: Tarjeta <token>` (el esquema no distingue mayúsculas, como manda HTTP)."""

    def authenticate(self, request):
        cabecera = request.headers.get("Authorization", "")
        esquema, _, token = cabecera.partition(" ")
        if esquema.lower() != ESQUEMA.lower() or not token.strip():
            return None
        cuenta = _cuenta_de_token(token.strip())
        if cuenta is None:
            raise AuthenticationFailed({"detail": "Tu sesión venció. Recupera tu tarjeta.", "codigo": "sesion_invalida"})
        if cuenta.estado != CuentaFidelizacion.Estado.ACTIVA:
            raise SorteoError(
                "cuenta_bloqueada", "Tu tarjeta está bloqueada. Pide ayuda en el mostrador.", 403,
            )
        return TitularTarjeta(cuenta), token

    def authenticate_header(self, request):
        return ESQUEMA
