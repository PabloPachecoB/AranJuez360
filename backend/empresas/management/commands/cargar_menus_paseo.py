"""Carga menús de muestra (precios referenciales) en los restaurantes reales del Paseo.

Uso:
    python manage.py cargar_menus_paseo

Lee empresas/datos/menus_paseo.json. Solo crea o actualiza los platos del archivo (por nombre)
y no toca los productos que el negocio haya cargado desde su panel. Como foto de cada plato usa,
por turnos, las fotos reales de la galería del local; si el local no tiene galería, la app
muestra su logo.
"""

import json
from decimal import Decimal
from itertools import cycle
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from empresas.models import Empresa, Producto

ARCHIVO = Path(__file__).resolve().parents[2] / "datos" / "menus_paseo.json"
STOCK = 50


class Command(BaseCommand):
    help = "Carga menús de muestra en los restaurantes reales del Paseo."

    @transaction.atomic
    def handle(self, *args, **options):
        menus = json.loads(ARCHIVO.read_text(encoding="utf-8"))["menus"]
        platos = 0
        for nombre, items in menus.items():
            empresa = Empresa.objects.filter(nombre=nombre).first()
            if empresa is None:
                self.stderr.write(f"  No existe el negocio {nombre!r}; corre antes importar_tiendas_paseo.")
                continue
            fotos = [f.imagen.name for f in empresa.fotos.order_by("orden", "id")]
            fotos = cycle(fotos) if fotos else None
            for seccion, plato, descripcion, precio in items:
                producto, _ = Producto.objects.update_or_create(
                    empresa=empresa, nombre=plato,
                    defaults=dict(seccion=seccion, descripcion=descripcion, precio=Decimal(str(precio)),
                                  stock=STOCK, activo=True),
                )
                if fotos and not producto.foto:
                    producto.foto.name = next(fotos)  # comparte el archivo de la galería, sin copiarlo
                    producto.save(update_fields=["foto"])
                platos += 1
        self.stdout.write(self.style.SUCCESS(f"Menús cargados: {platos} platos en {len(menus)} restaurantes."))
