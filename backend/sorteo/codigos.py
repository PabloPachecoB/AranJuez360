"""Códigos del Sorteo Paseo: el código opaco de la tarjeta y el de 6 dígitos de verificación."""

import hashlib
import hmac
import re
import secrets

from django.conf import settings

PREFIJO_TARJETA = "PA-"
# Sin 0/O ni 1/I/L: el código también se lee y se teclea a mano en caja.
ALFABETO_TARJETA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LARGO_TARJETA = 6
PATRON_TARJETA = re.compile(rf"^{re.escape(PREFIJO_TARJETA)}[{ALFABETO_TARJETA}]{{{LARGO_TARJETA}}}$")


def nuevo_codigo_tarjeta() -> str:
    cuerpo = "".join(secrets.choice(ALFABETO_TARJETA) for _ in range(LARGO_TARJETA))
    return f"{PREFIJO_TARJETA}{cuerpo}"


def normalizar_codigo_tarjeta(valor: str) -> str | None:
    """Devuelve el código en el formato canónico o None si no tiene la forma de una tarjeta."""
    codigo = (valor or "").strip().upper()
    return codigo if PATRON_TARJETA.match(codigo) else None


def nuevo_pase_id() -> str:
    """Identificador del pase en Wallet: estable aunque se revoque el código del QR."""
    return f"pw-{secrets.token_hex(10)}"


def nuevo_codigo_verificacion() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_codigo_verificacion(codigo: str) -> str:
    # Sal propia: un código del sorteo nunca coincide con el hash de un código de login.
    return hmac.new(settings.SECRET_KEY.encode(), f"sorteo:{codigo}".encode(), hashlib.sha256).hexdigest()
