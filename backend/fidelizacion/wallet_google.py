"""Tarjeta del Sorteo Paseo en Google Wallet.

Arma la clase de lealtad «Paseo Aranjuez» y el pase de cada cliente, los crea o
actualiza por la API de Google Wallet y firma el enlace «Agregar a Google Wallet».
Usa el emisor de ThinkUSoft con la marca del Paseo (ver la nota de Obsidian
«Sorteo Paseo (fidelización con Wallet)»).

Configuración por variables de entorno (nunca en git):
- GOOGLE_WALLET_ISSUER_ID: número del emisor en la consola de Google Pay & Wallet.
- GOOGLE_WALLET_KEY_PATH: ruta al JSON de la cuenta de servicio, fuera del repo.
- GOOGLE_WALLET_LOGO_URL: logo público por HTTPS, cuadrado (ideal 660×660, PNG o JPG).
- GOOGLE_WALLET_LOGO_ANCHO_URL: logo ancho del encabezado (opcional, ideal 1280×400).
- GOOGLE_WALLET_HERO_URL: banner público por HTTPS (opcional, ideal 1032×336).
- GOOGLE_WALLET_SITIO_URL: web del Paseo (opcional).
- GOOGLE_WALLET_REGLAS_URL: página con las reglas del sorteo (opcional).
- GOOGLE_WALLET_CLASE: sufijo de la clase (por defecto «paseo_sorteo»).

El pase solo lleva el código opaco del cliente, montos, puntos y, si se pasa,
su primer nombre. Nunca correo, celular ni en qué local compró.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path

import jwt
import requests

URL_GUARDAR = "https://pay.google.com/gp/v/save/"
URL_API = "https://walletobjects.googleapis.com/walletobjects/v1"
URL_TOKEN = "https://oauth2.googleapis.com/token"
ALCANCE = "https://www.googleapis.com/auth/wallet_object.issuer"
COLOR_FONDO = "#0B1F3A"  # azul marino de la paleta unificada
_ID_VALIDO = re.compile(r"^[A-Za-z0-9._-]+$")


class WalletNoConfigurado(RuntimeError):
    """Faltan el emisor, la llave o el logo en las variables de entorno."""


class WalletErrorAPI(RuntimeError):
    """Google Wallet respondió con un error."""


@dataclass(frozen=True)
class ConfigWallet:
    issuer_id: str
    email_cuenta: str
    llave_privada: str
    logo_url: str
    clase: str = "paseo_sorteo"
    hero_url: str = ""
    logo_ancho_url: str = ""
    sitio_url: str = ""
    reglas_url: str = ""

    @property
    def clase_id(self) -> str:
        return f"{self.issuer_id}.{self.clase}"

    def objeto_id(self, codigo: str) -> str:
        if not _ID_VALIDO.match(codigo):
            raise ValueError("El código del pase solo admite letras, números, punto, guion y guion bajo.")
        return f"{self.issuer_id}.{codigo}"


@dataclass(frozen=True)
class EstadoTarjeta:
    """Lo que se ve en el pase. Montos en Bs enteros."""

    codigo: str  # código opaco y revocable del QR, ej. PA-7K3M9X
    puntos: int
    participaciones: int
    faltan_bs: int
    pendientes: int
    fecha_sorteo: str  # texto ya formateado, ej. «20 dic»
    primer_nombre: str = ""  # opcional; solo el primer nombre
    # Identificador estable del pase en Google. Si se deja vacío se usa el código del QR (pases de prueba).
    # Con `pase_id`, revocar el código del QR no obliga a volver a guardar la tarjeta.
    pase_id: str = ""

    @property
    def id_pase(self) -> str:
        return self.pase_id or self.codigo


def _https_opcional(valor: str, nombre: str) -> str:
    valor = (valor or "").strip()
    if valor and not valor.startswith("https://"):
        raise WalletNoConfigurado(f"{nombre} debe ser una URL https.")
    return valor


def cargar_config(entorno=None) -> ConfigWallet:
    entorno = os.environ if entorno is None else entorno
    issuer = (entorno.get("GOOGLE_WALLET_ISSUER_ID") or "").strip()
    ruta = (entorno.get("GOOGLE_WALLET_KEY_PATH") or "").strip()
    logo = (entorno.get("GOOGLE_WALLET_LOGO_URL") or "").strip()
    faltan = [n for n, v in (("GOOGLE_WALLET_ISSUER_ID", issuer), ("GOOGLE_WALLET_KEY_PATH", ruta),
                             ("GOOGLE_WALLET_LOGO_URL", logo)) if not v]
    if faltan:
        raise WalletNoConfigurado("Faltan variables: " + ", ".join(faltan))
    if not issuer.isdigit():
        raise WalletNoConfigurado("GOOGLE_WALLET_ISSUER_ID debe ser solo números.")
    _https_opcional(logo, "GOOGLE_WALLET_LOGO_URL")
    archivo = Path(ruta)
    if not archivo.is_file():
        raise WalletNoConfigurado(f"No existe el archivo de la llave: {archivo}")
    datos = json.loads(archivo.read_text(encoding="utf-8"))
    if not datos.get("client_email") or not datos.get("private_key"):
        raise WalletNoConfigurado("El JSON no parece una llave de cuenta de servicio.")
    clase = (entorno.get("GOOGLE_WALLET_CLASE") or "paseo_sorteo").strip()
    if not _ID_VALIDO.match(clase):
        raise WalletNoConfigurado("GOOGLE_WALLET_CLASE solo admite letras, números, punto, guion y guion bajo.")
    return ConfigWallet(
        issuer_id=issuer, email_cuenta=datos["client_email"], llave_privada=datos["private_key"],
        logo_url=logo, clase=clase,
        logo_ancho_url=_https_opcional(entorno.get("GOOGLE_WALLET_LOGO_ANCHO_URL", ""),
                                       "GOOGLE_WALLET_LOGO_ANCHO_URL"),
        hero_url=_https_opcional(entorno.get("GOOGLE_WALLET_HERO_URL", ""), "GOOGLE_WALLET_HERO_URL"),
        sitio_url=_https_opcional(entorno.get("GOOGLE_WALLET_SITIO_URL", ""), "GOOGLE_WALLET_SITIO_URL"),
        reglas_url=_https_opcional(entorno.get("GOOGLE_WALLET_REGLAS_URL", ""), "GOOGLE_WALLET_REGLAS_URL"),
    )


def _texto(valor: str) -> dict:
    return {"defaultValue": {"language": "es", "value": valor}}


def _imagen(url: str, descripcion: str) -> dict:
    return {"sourceUri": {"uri": url}, "contentDescription": _texto(descripcion)}


def _campo(id_modulo: str) -> dict:
    return {"fields": [{"fieldPath": f"object.textModulesData['{id_modulo}']"}]}


def clase_lealtad(cfg: ConfigWallet) -> dict:
    clase = {
        "id": cfg.clase_id,
        "issuerName": "Paseo Aranjuez",
        "programName": "Sorteo Paseo",
        "programLogo": _imagen(cfg.logo_url, "Logo de Paseo Aranjuez"),
        "hexBackgroundColor": COLOR_FONDO,
        "reviewStatus": "UNDER_REVIEW",
        "countryCode": "BO",
        "localizedIssuerName": _texto("Paseo Aranjuez"),
        "localizedProgramName": _texto("Sorteo Paseo"),
        "multipleDevicesAndHoldersAllowedStatus": "ONE_USER_ALL_DEVICES",
        # Frente de la tarjeta. Al personalizar las filas, Google deja de mostrar los
        # puntos por su cuenta, así que van explícitos en la primera fila.
        "classTemplateInfo": {
            "cardTemplateOverride": {
                "cardRowTemplateInfos": [
                    {"twoItems": {
                        "startItem": {"firstValue": _campo("puntos")},
                        "endItem": {"firstValue": _campo("participaciones")},
                    }},
                    {"threeItems": {
                        "startItem": {"firstValue": _campo("faltan")},
                        "middleItem": {"firstValue": _campo("pendientes")},
                        "endItem": {"firstValue": _campo("sorteo")},
                    }},
                ],
            },
        },
    }
    if cfg.logo_ancho_url:
        # Reemplaza al logo redondo + nombre en el encabezado de la tarjeta.
        clase["wideProgramLogo"] = _imagen(cfg.logo_ancho_url, "Paseo Aranjuez 360")
    if cfg.hero_url:
        clase["heroImage"] = _imagen(cfg.hero_url, "Paseo Aranjuez")
    enlaces = []
    if cfg.sitio_url:
        enlaces.append({"id": "sitio", "uri": cfg.sitio_url, "description": "Paseo Aranjuez"})
    if cfg.reglas_url:
        enlaces.append({"id": "reglas", "uri": cfg.reglas_url, "description": "Reglas del sorteo"})
    if enlaces:
        clase["linksModuleData"] = {"uris": enlaces}
    return clase


def objeto_lealtad(cfg: ConfigWallet, estado: EstadoTarjeta) -> dict:
    pendientes = f"{estado.pendientes} compra{'s' if estado.pendientes != 1 else ''}"
    objeto = {
        "id": cfg.objeto_id(estado.id_pase),
        "classId": cfg.clase_id,
        "state": "ACTIVE",
        "accountId": estado.codigo,
        "loyaltyPoints": {"label": "Puntos", "balance": {"int": estado.puntos}},
        "secondaryLoyaltyPoints": {"label": "Participaciones", "balance": {"int": estado.participaciones}},
        "textModulesData": [
            {"id": "puntos", "header": "Puntos", "body": str(estado.puntos)},
            {"id": "participaciones", "header": "Participaciones", "body": str(estado.participaciones)},
            {"id": "faltan", "header": "Te faltan", "body": f"Bs {estado.faltan_bs}"},
            {"id": "pendientes", "header": "Pendientes", "body": pendientes},
            {"id": "sorteo", "header": "Sorteo", "body": estado.fecha_sorteo},
            {"id": "como", "header": "Cómo sumar",
             "body": "Muestra este QR en caja al pagar. Cada Bs 200 en compras validadas es 1 punto "
                     "y 1 participación; lo que sobra se guarda para la siguiente compra."},
        ],
        "barcode": {"type": "QR_CODE", "value": estado.codigo, "alternateText": estado.codigo},
    }
    nombre = (estado.primer_nombre or "").strip().split(" ")[0]
    if nombre:
        objeto["accountName"] = nombre
    return objeto


def enlace_guardar(cfg: ConfigWallet, estado: EstadoTarjeta, origenes: list[str] | None = None,
                   ahora: int | None = None) -> str:
    """Enlace con la clase y el pase completos dentro del JWT (sirve sin llamar a la API).

    Ojo: si la clase o el pase ya existen en Google, el enlace NO los actualiza.
    Para eso se usa ClienteWallet.publicar() y después enlace_guardar_existente().
    """
    return _firmar(cfg, {"loyaltyClasses": [clase_lealtad(cfg)],
                         "loyaltyObjects": [objeto_lealtad(cfg, estado)]}, origenes, ahora)


def enlace_guardar_existente(cfg: ConfigWallet, codigo: str, origenes: list[str] | None = None,
                             ahora: int | None = None) -> str:
    """Enlace corto a un pase que ya existe en Google (creado con ClienteWallet).

    `codigo` es el identificador con el que se publicó el pase: su `pase_id` o, si no tiene, el código del QR.
    """
    return _firmar(cfg, {"loyaltyObjects": [{"id": cfg.objeto_id(codigo), "classId": cfg.clase_id}]},
                   origenes, ahora)


def _firmar(cfg: ConfigWallet, carga: dict, origenes, ahora) -> str:
    reclamo = {
        "iss": cfg.email_cuenta,
        "aud": "google",
        "typ": "savetowallet",
        "iat": int(time.time()) if ahora is None else ahora,
        "origins": origenes or [],
        "payload": carga,
    }
    return URL_GUARDAR + jwt.encode(reclamo, cfg.llave_privada, algorithm="RS256")


class ClienteWallet:
    """Crea o actualiza la clase y los pases en Google Wallet."""

    def __init__(self, cfg: ConfigWallet, sesion: requests.Session | None = None):
        self.cfg = cfg
        self.sesion = sesion or requests.Session()
        self._token = ""
        self._vence = 0.0

    def _cabeceras(self) -> dict:
        if time.time() > self._vence - 60:
            ahora = int(time.time())
            asercion = jwt.encode({"iss": self.cfg.email_cuenta, "scope": ALCANCE, "aud": URL_TOKEN,
                                   "iat": ahora, "exp": ahora + 3600},
                                  self.cfg.llave_privada, algorithm="RS256")
            r = self.sesion.post(URL_TOKEN, timeout=20, data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": asercion})
            if r.status_code != 200:
                raise WalletErrorAPI(f"No se obtuvo el token de Google ({r.status_code}).")
            datos = r.json()
            self._token = datos["access_token"]
            self._vence = time.time() + int(datos.get("expires_in", 3600))
        return {"Authorization": f"Bearer {self._token}"}

    def _guardar(self, recurso: str, cuerpo: dict) -> dict:
        """Crea el recurso o, si ya existe, lo reemplaza con el contenido nuevo."""
        url = f"{URL_API}/{recurso}"
        r = self.sesion.get(f"{url}/{cuerpo['id']}", headers=self._cabeceras(), timeout=20)
        if r.status_code == 404:
            r = self.sesion.post(url, json=cuerpo, headers=self._cabeceras(), timeout=20)
        elif r.status_code == 200:
            r = self.sesion.put(f"{url}/{cuerpo['id']}", json=cuerpo, headers=self._cabeceras(), timeout=20)
        if r.status_code not in (200, 201):
            raise WalletErrorAPI(f"Google Wallet rechazó {recurso} ({r.status_code}): {r.text[:300]}")
        return r.json()

    def publicar_clase(self) -> dict:
        return self._guardar("loyaltyClass", clase_lealtad(self.cfg))

    def publicar_pase(self, estado: EstadoTarjeta) -> dict:
        """Crea o actualiza el pase; Google lo refresca solo en los teléfonos que lo tienen."""
        return self._guardar("loyaltyObject", objeto_lealtad(self.cfg, estado))
