"""Cotización del dólar para la Billetera Paseo, leída de fuentes reales.

- Oficial: el número que publica el BCB en su portada (no tiene API; se lee el HTML).
- USDT: mediana de los primeros anuncios del P2P de Binance (endpoint público de su web).

Cada fuente se guarda en caché unos minutos. Si una fuente falla se devuelve el último
valor bueno marcado como desactualizado; si nunca se obtuvo, queda en null (nunca se inventa).
"""

import html
import logging
import re
from datetime import date
from decimal import Decimal
from statistics import median

import requests
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

BCB_URL = "https://www.bcb.gob.bo/"
BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search"
CACHE_FRESCA = 30 * 60  # se vuelve a consultar cada 30 minutos
CACHE_ULTIMA_BUENA = 7 * 24 * 60 * 60
TIMEOUT = 12
CABECERAS = {"User-Agent": "Mozilla/5.0 (PaseoAranjuez360)"}

# Tarjeta "Tipo de cambio oficial" de la portada del BCB.
_TARJETA_OFICIAL = re.compile(r'is-tc-oficial.*?</article>', re.S)
_VALOR = re.compile(r'bcb-tco-num"\s*>\s*([\d.,]+)\s*<')
_VIGENCIA = re.compile(r'<time\s+datetime="(\d{4}-\d{2}-\d{2})"\s*>(.*?)</time>', re.S)


def _a_decimal(texto: str) -> Decimal:
    """'11,69' o '1.234,50' → Decimal."""
    return Decimal(texto.strip().replace(".", "").replace(",", "."))


def leer_oficial_bcb(contenido: str) -> dict:
    tarjeta = _TARJETA_OFICIAL.search(contenido)
    if not tarjeta:
        raise ValueError("No encontré la tarjeta del tipo de cambio oficial en la portada del BCB.")
    valor = _VALOR.search(tarjeta.group(0))
    if not valor:
        raise ValueError("La tarjeta del BCB no trae el valor.")
    vigencia = _VIGENCIA.search(tarjeta.group(0))
    return {
        "valor": _a_decimal(valor.group(1)),
        "fecha": vigencia.group(1) if vigencia else None,
        "vigencia": html.unescape(re.sub(r"\s+", " ", vigencia.group(2))).strip().capitalize() if vigencia else "",
    }


def _consultar_oficial() -> dict:
    resp = requests.get(BCB_URL, headers=CABECERAS, timeout=TIMEOUT)
    resp.raise_for_status()
    datos = leer_oficial_bcb(resp.content.decode("utf-8", errors="ignore"))
    return {
        "id": "oficial",
        "nombre": "Oficial BCB",
        "valor": datos["valor"],
        "fecha": datos["fecha"],
        "detalle": datos["vigencia"],
        "fuente": "Banco Central de Bolivia · tipo de cambio oficial",
        "url": BCB_URL,
    }


def _mediana_p2p(tipo: str) -> Decimal:
    resp = requests.post(
        BINANCE_P2P_URL,
        json={"fiat": "BOB", "asset": "USDT", "tradeType": tipo, "page": 1, "rows": 10,
              "payTypes": [], "publisherType": None},
        headers=CABECERAS,
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    precios = [Decimal(a["adv"]["price"]) for a in resp.json().get("data") or []]
    if not precios:
        raise ValueError(f"Binance P2P no devolvió anuncios ({tipo}).")
    return Decimal(median(precios)).quantize(Decimal("0.01"))


def _consultar_usdt() -> dict:
    compra = _mediana_p2p("BUY")  # lo que se paga en Bs por 1 USDT
    venta = _mediana_p2p("SELL")  # lo que se recibe en Bs al vender 1 USDT
    return {
        "id": "usdt",
        "nombre": "USDT (P2P)",
        "valor": ((compra + venta) / 2).quantize(Decimal("0.01")),
        "fecha": date.today().isoformat(),
        "detalle": f"Compra Bs {compra} · venta Bs {venta} (mediana de 10 anuncios)",
        "fuente": "Binance P2P · USDT/BOB",
        "url": "https://p2p.binance.com/es/trade/all-payments/USDT?fiat=BOB",
    }


def _con_cache(clave: str, consultar) -> dict | None:
    fresca = cache.get(f"cotizacion:{clave}")
    if fresca:
        return fresca
    try:
        datos = {**consultar(), "consultado_en": timezone.now().isoformat(), "desactualizada": False}
    except (requests.RequestException, ValueError, KeyError, ArithmeticError) as exc:
        logger.warning("No se pudo leer la cotización %s: %s", clave, exc)
        ultima = cache.get(f"cotizacion:{clave}:ultima")
        return {**ultima, "desactualizada": True} if ultima else None
    cache.set(f"cotizacion:{clave}", datos, CACHE_FRESCA)
    cache.set(f"cotizacion:{clave}:ultima", datos, CACHE_ULTIMA_BUENA)
    return datos


def cotizaciones() -> list[dict]:
    """Lista con la oficial y la USDT; cada una es null si su fuente nunca respondió."""
    lista = [_con_cache("oficial", _consultar_oficial), _con_cache("usdt", _consultar_usdt)]
    return [{**c, "valor": str(c["valor"])} if c else None for c in lista]
