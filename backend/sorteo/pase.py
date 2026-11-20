"""Pase de la tarjeta en Google Wallet: arma el estado desde la cuenta y lo publica.

El pase se identifica por `PaseWallet.pase_id` (estable); el QR lleva el código de tarjeta, que se puede revocar.
Si Google falla, la cuenta no se ve afectada: el pase queda en ERROR y se reintenta.
"""

import logging
from decimal import ROUND_CEILING, Decimal

from django.utils import timezone
from requests import RequestException

from fidelizacion.wallet_google import (
    ClienteWallet,
    EstadoTarjeta,
    WalletErrorAPI,
    WalletNoConfigurado,
    cargar_config,
    enlace_guardar_existente,
)

from . import services
from .codigos import nuevo_pase_id
from .errores import SorteoError
from .models import CuentaFidelizacion, EventoAuditoria, PaseWallet

logger = logging.getLogger(__name__)

_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def fecha_corta(fecha) -> str:
    return f"{fecha.day} {_MESES[fecha.month - 1]}" if fecha else "Por anunciar"


def estado_tarjeta(cuenta: CuentaFidelizacion, campania, pase_id: str) -> EstadoTarjeta:
    progreso = services.calcular_progreso(services.total_aprobado(cuenta, campania), campania.bs_por_punto)
    faltan = Decimal(progreso["faltan"])
    return EstadoTarjeta(
        codigo=services.asegurar_codigo(cuenta).codigo,
        pase_id=pase_id,
        puntos=progreso["puntos"],
        participaciones=progreso["participaciones"],
        faltan_bs=int(faltan.to_integral_value(rounding=ROUND_CEILING)),
        pendientes=progreso["pendientes"],
        fecha_sorteo=fecha_corta(campania.fecha_sorteo),
        primer_nombre=cuenta.primer_nombre,
    )


def _config():
    try:
        return cargar_config()
    except WalletNoConfigurado as exc:
        logger.warning("Google Wallet sin configurar: %s", exc)
        raise SorteoError(
            "wallet_no_configurado", "Google Wallet aún no está disponible.", 503,
        ) from exc


def publicar_google(cuenta: CuentaFidelizacion) -> tuple[PaseWallet, str]:
    """Crea o actualiza el pase de Google y devuelve el enlace «Agregar a Google Wallet»."""
    campania = services.campania_activa()
    if campania is None:
        raise SorteoError("campania_inactiva", "El sorteo aún no está activo.", 409)
    cfg = _config()

    pase, _ = PaseWallet.objects.get_or_create(
        cuenta=cuenta, plataforma=PaseWallet.Plataforma.GOOGLE, defaults={"pase_id": nuevo_pase_id()},
    )
    estado = estado_tarjeta(cuenta, campania, pase.pase_id)
    try:
        cliente = ClienteWallet(cfg)
        if pase.sincronizado_en is None:
            cliente.publicar_clase()  # reintentar también si la primera publicación no se completó
        cliente.publicar_pase(estado)
    except (WalletErrorAPI, RequestException, ValueError) as exc:
        pase.estado_sync = PaseWallet.Sync.ERROR
        pase.ultimo_error = "Error de conexión con Google Wallet." if isinstance(exc, RequestException) else str(exc)[:300]
        pase.intentos += 1
        pase.save(update_fields=["estado_sync", "ultimo_error", "intentos"])
        services._auditar(cuenta, EventoAuditoria.Tipo.WALLET_ERROR, detalle=pase.ultimo_error)
        raise SorteoError("wallet_error", "No pudimos preparar tu tarjeta. Prueba de nuevo.", 503) from exc

    pase.estado_sync = PaseWallet.Sync.SINCRONIZADO
    pase.sincronizado_en = timezone.now()
    pase.ultimo_error = ""
    pase.intentos += 1
    pase.save(update_fields=["estado_sync", "sincronizado_en", "ultimo_error", "intentos"])
    services._auditar(cuenta, EventoAuditoria.Tipo.WALLET_PUBLICADO, detalle=pase.pase_id)
    return pase, enlace_guardar_existente(cfg, pase.pase_id)


def resincronizar_si_existe(cuenta: CuentaFidelizacion) -> None:
    """Tras revocar el código: actualiza el QR del pase. Un fallo no debe impedir la revocación."""
    if not cuenta.pases.filter(plataforma=PaseWallet.Plataforma.GOOGLE).exists():
        return
    try:
        publicar_google(cuenta)
    except SorteoError as exc:
        logger.warning("No se pudo actualizar el pase de la cuenta %s tras revocar: %s", cuenta.pk, exc.codigo)
