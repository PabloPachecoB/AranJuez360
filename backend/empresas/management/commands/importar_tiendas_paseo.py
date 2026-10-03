"""Importa las tiendas reales de paseoaranjuez.com al directorio (como fichas públicas, sin cuenta).

Uso:
    python manage.py importar_tiendas_paseo                 # usa la copia guardada en empresas/datos
    python manage.py importar_tiendas_paseo --desde-web     # vuelve a leer paseoaranjuez.com/stores
    python manage.py importar_tiendas_paseo --sin-imagenes  # no descarga logos ni fotos

Las tiendas quedan sin usuario: el admin las invita después desde "Invitaciones" para que
cada una administre su ficha. Se puede correr varias veces (actualiza por nombre y solo
descarga las imágenes que faltan).
"""

import json
import re
import unicodedata
from pathlib import Path

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction

from empresas.models import Categoria, Empresa, FotoEmpresa
from empresas.rubros import rubro_comercial

SITIO = "https://paseoaranjuez.com"
ARCHIVO = Path(__file__).resolve().parents[2] / "datos" / "tiendas_paseo_aranjuez.json"
MAX_FOTOS = 8
PISOS = {"Planta Baja": "PB", "Primer Piso": "1", "Segundo Piso": "2", "Tercer Piso": "3", "Cuarto Piso": "4"}

# Rubro del sitio (primera etiqueta) -> categoría del Paseo.
CATEGORIAS = {
    "ropa": "Moda", "jeans": "Moda", "lenceria": "Moda", "boutique": "Moda",
    "calzado": "Calzado",
    "cosmeticos": "Belleza y cuidado personal", "perfumeria": "Belleza y cuidado personal",
    "cuidado": "Belleza y cuidado personal", "nails": "Belleza y cuidado personal",
    "joyeria": "Joyería y accesorios", "joyas": "Joyería y accesorios", "relojeria": "Joyería y accesorios",
    "accesorios": "Joyería y accesorios",
    "jugueteria": "Juguetería y niños", "bebes": "Juguetería y niños", "juegos": "Juguetería y niños",
    "tecnologia": "Tecnología", "electronica": "Electrónica",
    "telecomunicaciones": "Servicios", "servicios": "Servicios",
    "banca": "Banca", "banco": "Banca",
    "concesionaria": "Concesionaria", "automoviles": "Concesionaria",
    "hogar": "Hogar y decoración", "floristeria": "Hogar y decoración",
    "deportes": "Deportes", "fitness": "Deportes",
    "artesanias": "Artesanías",
    "optica": "Óptica",
}


def _sin_tildes(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", texto.lower()) if not unicodedata.combining(c))


def _categoria_detallada(tienda: dict) -> str:
    etiquetas = [_sin_tildes(e) for e in tienda.get("categories") or []]
    for etiqueta in etiquetas:
        # "ropa interior", "ropa infantil"... cuentan por su primera palabra.
        for clave in (etiqueta, etiqueta.split(" ")[0]):
            if clave in CATEGORIAS:
                return CATEGORIAS[clave]
    nombre = _sin_tildes(tienda["title"])
    for clave, categoria in CATEGORIAS.items():
        if clave in nombre:
            return categoria
    # Pisos 3 y 4: patio de comidas y restaurantes; también las etiquetas en minúscula (brocheta, pizzas...).
    if tienda.get("floor") in ("Tercer Piso", "Cuarto Piso") or etiquetas:
        return "Comida"
    return "Otros"


def categoria_de(tienda: dict) -> str:
    return rubro_comercial(_categoria_detallada(tienda), tienda["title"])


def descripcion_de(tienda: dict) -> str:
    etiquetas = [e for e in tienda.get("categories") or [] if len(e) > 2]
    if not etiquetas:
        return ""
    texto = ", ".join(dict.fromkeys(e.lower() for e in etiquetas))
    return texto[0].upper() + texto[1:] + "."


def whatsapp_de(tienda: dict) -> str:
    enlace = (tienda.get("social") or {}).get("whatsapp") or ""
    numero = re.sub(r"\D", "", enlace)
    return numero[3:] if numero.startswith("591") and len(numero) == 11 else numero


def _slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", _sin_tildes(texto))[:40] or "tienda"


class Command(BaseCommand):
    help = "Importa las tiendas reales de paseoaranjuez.com al directorio del Paseo."

    def add_arguments(self, parser):
        parser.add_argument("--desde-web", action="store_true", help="Lee la lista actual de paseoaranjuez.com.")
        parser.add_argument("--sin-imagenes", action="store_true", help="No descarga logos ni fotos.")

    def _tiendas(self, desde_web: bool) -> list:
        if desde_web:
            resp = requests.get(f"{SITIO}/stores", headers={"Accept": "application/json"}, timeout=30)
            resp.raise_for_status()
            return resp.json()
        return json.loads(ARCHIVO.read_text(encoding="utf-8"))["tiendas"]

    def _descargar(self, ruta: str):
        if not ruta or "/img/test/" in ruta:  # imágenes de prueba del sitio
            return None
        try:
            resp = requests.get(f"{SITIO}{ruta}" if ruta.startswith("/") else ruta, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as exc:
            self.stderr.write(f"  No se pudo descargar {ruta}: {exc}")
            return None
        return ContentFile(resp.content, name=ruta.rsplit("/", 1)[-1])

    def handle(self, *args, desde_web=False, sin_imagenes=False, **options):
        tiendas = self._tiendas(desde_web)
        creadas = actualizadas = imagenes = 0
        for t in tiendas:
            social = t.get("social") or {}
            categoria, _ = Categoria.objects.get_or_create(nombre=categoria_de(t))
            datos = {
                "tipo": Empresa.Tipo.NEGOCIO,
                "categoria": categoria,
                "piso": PISOS.get(t.get("floor"), ""),
                "whatsapp": whatsapp_de(t),
                "facebook": (social.get("facebook") or "")[:200],
                "instagram": (social.get("instagram") or "")[:200],
                "activo": True,
            }
            with transaction.atomic():
                empresa = Empresa.objects.filter(nombre=t["title"]).first()
                if empresa is None:
                    empresa = Empresa.objects.create(
                        nombre=t["title"], email_contacto=f"{_slug(t['title'])}@tiendas.paseo.bo",
                        descripcion=descripcion_de(t), **datos,
                    )
                    creadas += 1
                else:
                    for campo, valor in datos.items():
                        setattr(empresa, campo, valor)
                    if not empresa.descripcion:
                        empresa.descripcion = descripcion_de(t)
                    empresa.save()
                    actualizadas += 1

            if sin_imagenes:
                continue
            if not empresa.logo and (archivo := self._descargar(t.get("logo"))):
                empresa.logo.save(archivo.name, archivo, save=True)
                imagenes += 1
            fotos = [f for f in (t.get("images") or []) if f][:MAX_FOTOS]
            if fotos and not empresa.fotos.exists():
                for orden, ruta in enumerate(fotos):
                    if archivo := self._descargar(ruta):
                        FotoEmpresa.objects.create(empresa=empresa, imagen=archivo, orden=orden)
                        imagenes += 1
            if not empresa.portada and (primera := empresa.fotos.first()):
                empresa.portada.save(primera.imagen.name.rsplit("/", 1)[-1], primera.imagen.file, save=True)

        self.stdout.write(self.style.SUCCESS(
            f"Tiendas de paseoaranjuez.com: {creadas} nuevas, {actualizadas} actualizadas, {imagenes} imágenes descargadas."
        ))
