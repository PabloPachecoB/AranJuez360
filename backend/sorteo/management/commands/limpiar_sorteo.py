"""Borra los códigos de verificación viejos, las cuentas que nunca se verificaron y las consultas de caja antiguas.

    python manage.py limpiar_sorteo
    python manage.py limpiar_sorteo --dias-desafios 2 --dias-pendientes 7 --dias-auditoria 180

Pensado para correr una vez al día (cron o tarea programada). No toca cuentas verificadas ni sus tarjetas, y la
auditoría de registro, verificación y revocación se conserva siempre.
"""

from django.core.management.base import BaseCommand

from sorteo import services


class Command(BaseCommand):
    help = "Limpia datos viejos del sorteo: códigos de verificación, cuentas sin verificar y consultas de caja."

    def add_arguments(self, parser):
        parser.add_argument("--dias-desafios", type=int, default=2)
        parser.add_argument("--dias-pendientes", type=int, default=7)
        parser.add_argument("--dias-auditoria", type=int, default=180, help="Antigüedad de las consultas en caja.")

    def handle(self, *args, **o):
        desafios, cuentas, consultas = services.limpiar(o["dias_desafios"], o["dias_pendientes"], o["dias_auditoria"])
        self.stdout.write(self.style.SUCCESS(
            f"Borrados {desafios} códigos de verificación, {cuentas} cuentas sin verificar "
            f"y {consultas} consultas de caja antiguas."
        ))
