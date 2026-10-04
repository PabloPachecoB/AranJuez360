"""Carga la cartelera del Cinema Lounge y los eventos reales publicados en paseoaranjuez.com.

Uso:
    python manage.py importar_agenda_paseo                 # usa entretenimiento/datos/agenda_paseo.json
    python manage.py importar_agenda_paseo --sin-imagenes  # no descarga pósters ni imágenes de eventos

El sitio publica la agenda como texto libre (publicaciones de Instagram), así que la copia se
revisa a mano y se actualiza el JSON. Se puede correr varias veces: actualiza por título,
regenera las funciones y retira de la app la cartelera y los eventos ficticios de la demo.
"""

import json
from datetime import datetime
from pathlib import Path

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from empresas.management.commands.cargar_demo import EVENTOS_FICTICIOS, PELICULAS_FICTICIAS
from entretenimiento.models import Espacio, Evento, Funcion, Pelicula

SITIO = "https://paseoaranjuez.com"
ARCHIVO = Path(__file__).resolve().parents[2] / "datos" / "agenda_paseo.json"


def _momento(texto):
    return timezone.make_aware(datetime.fromisoformat(texto)) if texto else None


class Command(BaseCommand):
    help = "Carga la cartelera y los eventos reales del Paseo Aranjuez."

    def add_arguments(self, parser):
        parser.add_argument("--sin-imagenes", action="store_true", help="No descarga pósters ni imágenes de eventos.")

    def _descargar(self, ruta):
        url = ruta if ruta.startswith("http") else f"{SITIO}{ruta}"
        try:
            # Wikimedia pide identificar al cliente con un User-Agent propio
            resp = requests.get(url, timeout=30, headers={"User-Agent": "PaseoAranjuez360/1.0 (agenda del Paseo)"})
            resp.raise_for_status()
        except requests.RequestException as exc:
            self.stderr.write(f"  No se pudo descargar {ruta}: {exc}")
            return None
        return resp.content

    @transaction.atomic
    def handle(self, *args, sin_imagenes=False, **options):
        datos = json.loads(ARCHIVO.read_text(encoding="utf-8"))

        retiradas = Pelicula.objects.filter(titulo__in=PELICULAS_FICTICIAS).update(activo=False)
        retirados = Evento.objects.filter(titulo__in=EVENTOS_FICTICIOS).update(activo=False)

        for p in datos["peliculas"]:
            funciones = [_momento(inicio) for inicio in p["funciones"]]
            pelicula, _ = Pelicula.objects.update_or_create(
                titulo=p["titulo"],
                # Sin funciones por delante no se muestra (si no, la app la pondría en "Próximamente").
                defaults=dict(genero=p["genero"], clasificacion=p["clasificacion"], duracion_min=p["duracion_min"],
                              sinopsis=p["sinopsis"], estreno=False, activo=max(funciones) > timezone.now()),
            )
            pelicula.funciones.filter(reservas__isnull=True).exclude(inicio__in=funciones).delete()
            for inicio in funciones:
                Funcion.objects.update_or_create(pelicula=pelicula, inicio=inicio,
                                                 defaults={"sala": "Cinema Lounge", "precio": p.get("precio")})
            poster = p.get("poster")
            if poster and not sin_imagenes and not pelicula.poster:
                contenido = self._descargar(poster)
                if contenido:
                    pelicula.poster.save(poster.rsplit("/", 1)[-1], ContentFile(contenido), save=True)

        # Espacios que la comunidad puede pedir en Escenario abierto
        for esp in datos.get("espacios", []):
            Espacio.objects.update_or_create(nombre=esp["nombre"], defaults={
                k: esp[k] for k in ("lugar", "capacidad", "descripcion", "equipamiento")
            })

        imagenes = {}
        for e in datos["eventos"]:
            evento, _ = Evento.objects.update_or_create(
                titulo=e["titulo"],
                defaults=dict(categoria=e["categoria"], inicio=_momento(e["inicio"]), fin=_momento(e.get("fin")),
                              lugar=e["lugar"], descripcion=e["descripcion"], precio=e.get("precio"),
                              destacado=e.get("destacado", False), activo=True),
            )
            ruta = e.get("imagen")
            if ruta and not sin_imagenes and not evento.imagen:
                if ruta not in imagenes:
                    imagenes[ruta] = self._descargar(ruta)
                if imagenes[ruta]:
                    evento.imagen.save(ruta.rsplit("/", 1)[-1], ContentFile(imagenes[ruta]), save=True)

        self.stdout.write(self.style.SUCCESS(
            f"Agenda cargada: {len(datos['peliculas'])} películas, {len(datos['eventos'])} eventos, "
            f"{len(datos.get('espacios', []))} espacios de Escenario abierto "
            f"({retiradas} películas y {retirados} eventos de demo retirados)."
        ))
