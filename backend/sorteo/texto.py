"""Utilidades de texto del Sorteo Paseo: nombres y correos."""

import re
import unicodedata

PARTICULAS = {"de", "del", "la", "las", "los", "y", "da", "do", "dos", "van", "von"}
_APOSTROFOS = "'’"
_DOMINIOS_GMAIL = {"gmail.com", "googlemail.com"}


def nfc(valor: str) -> str:
    """Acentos como un solo carácter: «José» (e + acento suelto) pasa a «José»."""
    return unicodedata.normalize("NFC", valor or "")


_ESPACIOS = re.compile(r"\s+")
# Letras de cualquier idioma (con tildes y ñ) separadas por espacio, guion, apóstrofo o punto.
_NOMBRE = re.compile(r"^[^\W\d_]+(?:[ '’\-.]+[^\W\d_]+)*\.?$")
MENSAJE_NOMBRE = "Usa solo letras."


def limpiar_nombre(valor: str) -> str:
    """Nombre o apellido listo para guardar: NFC, sin espacios de más y con mayúsculas ordenadas.

    Lanza ValueError si tiene algo que no sea letras. Lo usan el registro público y el admin.
    """
    valor = _ESPACIOS.sub(" ", nfc(valor).strip())
    if not _NOMBRE.match(valor):
        raise ValueError(MENSAJE_NOMBRE)
    return capitalizar_nombre(valor)


def capitalizar_nombre(valor: str) -> str:
    """«luis alberto» → «Luis Alberto», «DE LA CRUZ» → «De la Cruz», «o'brien» → «O'Brien».

    Si el texto ya mezcla mayúsculas y minúsculas se respeta tal cual (McDonald, María José).
    """
    if not (valor.islower() or valor.isupper()):
        return valor

    def palabra(p: str, primera: bool) -> str:
        if not primera and p.lower() in PARTICULAS:
            return p.lower()
        partes = []
        for parte in p.split("-"):
            parte = parte[:1].upper() + parte[1:].lower()
            # D'Angelo, O'Brien: tras un apóstrofo de prefijo corto también va mayúscula
            m = re.match(rf"^([^{_APOSTROFOS}]{{1,2}})([{_APOSTROFOS}])(.+)$", parte)
            if m:
                parte = m.group(1) + m.group(2) + m.group(3)[:1].upper() + m.group(3)[1:]
            partes.append(parte)
        return "-".join(partes)

    return " ".join(palabra(p, i == 0) for i, p in enumerate(valor.split(" ")))


def iniciales_apellidos(apellidos: str) -> str:
    """«Gómez Pérez» → «G. P.»; «De la Cruz» → «C.» (las partículas no cuentan)."""
    palabras = [p for p in (apellidos or "").split() if p]
    utiles = [p for p in palabras if p.lower() not in PARTICULAS] or palabras[:1]
    return " ".join(f"{p[0].upper()}." for p in utiles)


def correo_canonico(correo: str) -> str:
    """Forma comparable de un correo: minúsculas, sin «+etiqueta» y, en Gmail, sin puntos.

    Sirve para señalar tarjetas repetidas con alias (a.b+1@gmail.com y ab@gmail.com son la misma bandeja).
    """
    correo = (correo or "").strip().lower()
    local, _, dominio = correo.partition("@")
    local = local.split("+", 1)[0]
    if dominio in _DOMINIOS_GMAIL:
        local = local.replace(".", "")
        dominio = "gmail.com"
    return f"{local}@{dominio}"
