"""Publica un pase de prueba del Sorteo Paseo en Google Wallet e imprime el enlace para guardarlo.

    python manage.py wallet_google_prueba
    python manage.py wallet_google_prueba --codigo PA-TEST02 --puntos 3 --nombre María
    python manage.py wallet_google_prueba --sin-api   # solo el enlace firmado, sin llamar a Google
"""

from django.core.management.base import BaseCommand, CommandError

from fidelizacion.wallet_google import (
    ClienteWallet,
    EstadoTarjeta,
    WalletErrorAPI,
    WalletNoConfigurado,
    cargar_config,
    enlace_guardar,
    enlace_guardar_existente,
)


class Command(BaseCommand):
    help = "Publica un pase de prueba del Sorteo Paseo en Google Wallet (datos ficticios)."

    def add_arguments(self, parser):
        parser.add_argument("--codigo", default="PA-TEST01")
        parser.add_argument("--nombre", default="")
        parser.add_argument("--puntos", type=int, default=6)
        parser.add_argument("--participaciones", type=int, default=None)
        parser.add_argument("--faltan", type=int, default=70)
        parser.add_argument("--pendientes", type=int, default=2)
        parser.add_argument("--sorteo", default="20 dic")
        parser.add_argument("--sin-api", action="store_true",
                            help="No llama a la API: el enlace lleva todo, pero no actualiza pases existentes.")

    def handle(self, *args, **o):
        try:
            cfg = cargar_config()
            estado = EstadoTarjeta(
                codigo=o["codigo"], puntos=o["puntos"],
                participaciones=o["participaciones"] if o["participaciones"] is not None else o["puntos"],
                faltan_bs=o["faltan"], pendientes=o["pendientes"], fecha_sorteo=o["sorteo"],
                primer_nombre=o["nombre"],
            )
            if o["sin_api"]:
                enlace = enlace_guardar(cfg, estado)
            else:
                cliente = ClienteWallet(cfg)
                cliente.publicar_clase()
                cliente.publicar_pase(estado)
                self.stdout.write("Clase y pase publicados en Google Wallet.")
                enlace = enlace_guardar_existente(cfg, estado.codigo)
        except (WalletNoConfigurado, WalletErrorAPI, ValueError) as e:
            raise CommandError(str(e)) from e
        self.stdout.write("Enlace para guardar el pase:")
        self.stdout.write(enlace)
