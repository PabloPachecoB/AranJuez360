"""Carga el catálogo real de Hoy Hay Café (no es dato de demo inventado).

Lee hoy_hay_cafe_catalogo_online/catalogo_hoy_hay_cafe.json (en la raíz del
repo, junto a backend/) y crea la Empresa + sus Productos con las fotos de
sección disponibles. Solo se ejecuta una vez: si la empresa ya existe no
vuelve a cargar productos (igual que cargar_demo).

Uso: python manage.py cargar_hoy_hay_cafe
"""

import json
from collections import Counter
from datetime import time
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from empresas.models import Categoria, Empresa, Horario, Producto
from empresas.services import rol_responsable
from usuarios.models import Usuario

PASSWORD = "Paseo2026!"
EMAIL = "hoyhaycafe@paseo.bo"
STOCK_INICIAL = 25

CATALOGO_DIR = Path(settings.BASE_DIR).parent / "hoy_hay_cafe_catalogo_online"
JSON_PATH = CATALOGO_DIR / "catalogo_hoy_hay_cafe.json"
IMAGENES_DIR = CATALOGO_DIR / "imagenes"

# Solo hay fotos por sección (no una por cada producto); portado del mapa
# que usa el index.html original del catálogo.
IMAGEN_POR_SECCION = {
    ("Cafetería de especialidad", "Calientes"): "cafes_calientes_y_frios.jpg",
    ("Cafetería de especialidad", "Fríos"): "cafes_calientes_y_frios.jpg",
    ("Cafetería de especialidad", "Métodos y filtrados"): "metodos_filtrados.jpg",
    ("Infusiones y bebidas", "Tecitos"): "tecitos_e_infusiones.jpg",
    ("Infusiones y bebidas", "Fríos"): "bebidas_frias_y_calderitas.jpg",
    ("Infusiones y bebidas", "Calderitas"): "bebidas_frias_y_calderitas.jpg",
    ("Infusiones y bebidas", "Jugos de fruta"): "jugos_y_chocolates.jpg",
    ("Infusiones y bebidas", "Chocolates"): "jugos_y_chocolates.jpg",
    ("Repostería", "Dulce"): "reposteria_postres.jpg",
    ("Repostería", "Salada"): "reposteria_dulce_y_salada_superior.jpg",
    ("Sándwich de marraqueta", ""): "sandwiches_marraqueta.jpg",
    ("Sándwich cuñapé", ""): "sandwiches_cunape.jpg",
    ("Desayunos", ""): "desayunos_principales.jpg",
}


def _secciones(data):
    """Aplana categorias -> subcategorias -> productos en una sola lista de
    (nombre_categoria, nombre_subcategoria, nota_categoria, producto)."""
    for cat in data["categorias"]:
        nombre_categoria = cat["categoria"]
        nota = cat.get("nota", "")
        subs = cat.get("subcategorias") or [{"nombre": "", "productos": cat.get("productos", [])}]
        for sub in subs:
            nombre_sub = sub.get("nombre", "")
            for producto in sub["productos"]:
                yield nombre_categoria, nombre_sub, nota, producto


def _descripcion(producto, nota_categoria):
    partes = []
    if producto.get("descripcion"):
        partes.append(producto["descripcion"])
    if producto.get("sabores"):
        partes.append("Sabores: " + ", ".join(producto["sabores"]))
    if "precio" not in producto and producto.get("precio_hasta"):
        partes.append(f"Precio desde Bs {producto['precio_desde']} hasta Bs {producto['precio_hasta']}.")
    if nota_categoria:
        partes.append(nota_categoria)
    return " ".join(partes)


def _precio(producto):
    return producto["precio"] if "precio" in producto else producto["precio_desde"]


class Command(BaseCommand):
    help = "Carga el catálogo real de Hoy Hay Café en la base de datos."

    def _usuario(self, username, **campos):
        campos.setdefault("email_verificado", True)
        user, creado = Usuario.objects.get_or_create(username=username, defaults=campos)
        if creado:
            user.set_password(PASSWORD)
            user.save()
        return user

    def _archivo(self, nombre):
        return File(open(IMAGENES_DIR / nombre, "rb"), name=nombre)

    @transaction.atomic
    def handle(self, *args, **options):
        if not JSON_PATH.exists():
            raise CommandError(f"No se encontró {JSON_PATH}")
        data = json.loads(JSON_PATH.read_text(encoding="utf-8"))

        categoria, _ = Categoria.objects.get_or_create(nombre="Comida")
        empresa, creada = Empresa.objects.get_or_create(
            nombre=data["negocio"],
            defaults=dict(tipo=Empresa.Tipo.NEGOCIO, categoria=categoria, email_contacto=EMAIL),
        )

        creados = 0
        if creada:
            logo = IMAGENES_DIR / "logo_hoy_hay_cafe.jpg"
            if logo.exists():
                empresa.logo.save(logo.name, self._archivo(logo.name), save=True)
            for dia in range(6):
                Horario.objects.create(empresa=empresa, dia=dia, abre=time(10), cierra=time(21))
            Horario.objects.create(empresa=empresa, dia=6, cerrado=True)

            secciones = list(_secciones(data))
            conteo_nombres = Counter(p["nombre"] for _, _, _, p in secciones)

            for nombre_categoria, nombre_sub, nota, p in secciones:
                nombre = p["nombre"]
                if conteo_nombres[nombre] > 1:
                    nombre = f"{nombre} ({nombre_sub or nombre_categoria})"
                producto = Producto.objects.create(
                    empresa=empresa,
                    nombre=nombre,
                    descripcion=_descripcion(p, nota),
                    precio=_precio(p),
                    stock=STOCK_INICIAL,
                )
                archivo = IMAGEN_POR_SECCION.get((nombre_categoria, nombre_sub))
                if archivo:
                    producto.foto.save(archivo, self._archivo(archivo), save=True)
                creados += 1

        self._usuario(EMAIL, email=EMAIL, rol=rol_responsable(empresa), empresa=empresa)

        if creada:
            self.stdout.write(self.style.SUCCESS(
                f"Hoy Hay Café cargado: {creados} productos. Login: {EMAIL} / {PASSWORD}"
            ))
        else:
            self.stdout.write("Hoy Hay Café ya existía, no se volvió a cargar.")
