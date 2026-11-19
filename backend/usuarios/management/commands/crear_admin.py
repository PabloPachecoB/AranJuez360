"""Crea (o actualiza) una cuenta de Administrador del Paseo para el panel web.

Uso:  python manage.py crear_admin correo@dominio.com
La contraseña se pide por consola (no queda en el historial).
"""

import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from usuarios.models import Usuario


class Command(BaseCommand):
    help = "Crea o actualiza una cuenta de Administrador para el panel web."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--nombre", default="Administración")

    def handle(self, *args, email, nombre, **options):
        email = email.strip().lower()
        password = getpass.getpass("Contraseña: ")
        if password != getpass.getpass("Repite la contraseña: "):
            raise CommandError("Las contraseñas no coinciden.")
        usuario = Usuario.objects.filter(username=email).first() or Usuario(username=email, email=email)
        try:
            validate_password(password, usuario)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages))
        usuario.first_name = usuario.first_name or nombre
        usuario.rol = Usuario.Rol.ADMIN
        usuario.is_staff = usuario.is_superuser = True
        usuario.email_verificado = True
        usuario.debe_cambiar_password = False
        usuario.set_password(password)
        usuario.save()
        self.stdout.write(self.style.SUCCESS(f"Administrador listo: {email}"))
