"""Datos de demo: admin, portero, cliente, negocios, emprendimiento, oficina y cajero.

Uso: python manage.py cargar_demo
Todas las cuentas de demo usan la contraseña "Paseo2026!".
"""

from datetime import time

from django.core.management.base import BaseCommand
from django.db import transaction

from empresas.models import Categoria, Empresa, Horario, Producto
from empresas.services import rol_responsable
from usuarios.models import Usuario

PASSWORD = "Paseo2026!"

EMPRESAS = [
    ("Café Aranjuez", "NEGOCIO", "Comida", "1", "12", [("Chocolate caliente", 25), ("Capuchino", 22)]),
    ("Burger Paseo", "NEGOCIO", "Comida", "1", "05", [("Hamburguesa clásica", 45), ("Papas fritas", 18)]),
    ("TecnoPlus", "NEGOCIO", "Tecnología", "2", "21", [("Audífonos Bluetooth", 250), ("Cargador rápido", 120)]),
    ("Moda Urbana", "NEGOCIO", "Moda", "2", "08", [("Camisa de lino", 180), ("Jeans slim", 260)]),
    ("Dulce Hogar", "EMPRENDIMIENTO", "Comida", "PB", "K3", [("Brownie artesanal", 15), ("Alfajores x6", 30)]),
    ("Estudio Legal Andino", "OFICINA", "Servicios profesionales", "5", "502",
     [("Asesoría legal (consulta)", 200)]),
]


class Command(BaseCommand):
    help = "Carga datos de demostración para Paseo Aranjuez 360."

    def _usuario(self, username, **campos):
        campos.setdefault("email_verificado", True)
        user, creado = Usuario.objects.get_or_create(username=username, defaults=campos)
        if creado:
            user.set_password(PASSWORD)
            user.save()
        return user

    @transaction.atomic
    def handle(self, *args, **options):
        self._usuario("admin@paseo.bo", email="admin@paseo.bo", rol=Usuario.Rol.ADMIN,
                      is_staff=True, is_superuser=True)
        self._usuario("portero@paseo.bo", email="portero@paseo.bo", rol=Usuario.Rol.PORTERO,
                      first_name="Portero", last_name="Demo")
        self._usuario("cliente@paseo.bo", email="cliente@paseo.bo", rol=Usuario.Rol.CLIENTE,
                      first_name="Cliente", last_name="Demo", ci="1234567", celular="71234567")

        for nombre, tipo, categoria, piso, local, productos in EMPRESAS:
            cat, _ = Categoria.objects.get_or_create(nombre=categoria)
            slug = nombre.lower().replace(" ", "").replace("é", "e")
            empresa, creada = Empresa.objects.get_or_create(
                nombre=nombre,
                defaults=dict(tipo=tipo, categoria=cat, email_contacto=f"{slug}@paseo.bo",
                              piso=piso, local=local),
            )
            if creada:
                for dia in range(6):
                    Horario.objects.create(empresa=empresa, dia=dia, abre=time(10), cierra=time(21))
                Horario.objects.create(empresa=empresa, dia=6, cerrado=True)
                for prod, precio in productos:
                    Producto.objects.create(empresa=empresa, nombre=prod, precio=precio)
            self._usuario(empresa.email_contacto, email=empresa.email_contacto,
                          rol=rol_responsable(empresa), empresa=empresa)

        cafe = Empresa.objects.get(nombre="Café Aranjuez")
        self._usuario("caja.cafe@paseo.bo", email="caja.cafe@paseo.bo", rol=Usuario.Rol.CAJERO, empresa=cafe)

        self.stdout.write(self.style.SUCCESS(f"Datos de demo listos. Contraseña de todas las cuentas: {PASSWORD}"))
        self.stdout.write(f"Código QR/NFC de Café Aranjuez: {cafe.codigo_fidelizacion}")
