"""Crea la campaña del Sorteo Paseo.

    python manage.py crear_campania_sorteo --fecha-sorteo 2026-12-20
    python manage.py crear_campania_sorteo --fecha-sorteo 2026-12-20 --lanzar

Sin `--lanzar` queda en borrador (se edita y se lanza desde el admin de Django). Al lanzarla, sus reglas quedan fijas.
"""

from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from sorteo.models import Campania


def _fecha(valor):
    try:
        return date.fromisoformat(valor)
    except ValueError as exc:
        raise CommandError(f"Fecha inválida «{valor}»: usa AAAA-MM-DD.") from exc


class Command(BaseCommand):
    help = "Crea la campaña del Sorteo Paseo (borrador, o activa con --lanzar)."

    def add_arguments(self, parser):
        parser.add_argument("--nombre", default="Sorteo Paseo")
        parser.add_argument("--bs-por-punto", default="200")
        parser.add_argument("--inicio")
        parser.add_argument("--cierre")
        parser.add_argument("--fecha-sorteo")
        parser.add_argument("--lanzar", action="store_true", help="Deja la campaña activa (reglas fijas).")

    def handle(self, *args, **o):
        try:
            bs = Decimal(o["bs_por_punto"])
        except InvalidOperation as exc:
            raise CommandError("--bs-por-punto debe ser un número.") from exc
        if bs <= 0:
            raise CommandError("--bs-por-punto debe ser mayor que cero.")
        if o["lanzar"] and Campania.objects.filter(estado=Campania.Estado.ACTIVA).exists():
            raise CommandError("Ya hay una campaña activa: páusala o ciérrala antes de lanzar otra.")
        campania = Campania(
            nombre=o["nombre"], bs_por_punto=bs,
            inicio=_fecha(o["inicio"]) if o["inicio"] else None,
            cierre=_fecha(o["cierre"]) if o["cierre"] else None,
            fecha_sorteo=_fecha(o["fecha_sorteo"]) if o["fecha_sorteo"] else None,
        )
        try:
            campania._validar_fechas()
        except ValidationError as exc:
            raise CommandError(" ".join(m for ms in exc.message_dict.values() for m in ms)) from exc
        if o["lanzar"]:
            campania.estado, campania.lanzada_en = Campania.Estado.ACTIVA, timezone.now()
        campania.save()
        self.stdout.write(self.style.SUCCESS(f"Campaña creada: {campania}"))
