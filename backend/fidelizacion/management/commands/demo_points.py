import secrets
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from empresas.models import Empresa
from usuarios.models import Usuario
from pedidos.models import Pedido
from pedidos.services import validar_retiro
from fidelizacion.models import Recompensa


class Command(BaseCommand):
    help = 'Crea una demostración ficticia Points, solo en DEBUG con correo de consola.'

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG or settings.EMAIL_BACKEND != 'django.core.mail.backends.console.EmailBackend':
            raise CommandError('Solo se permite en DEBUG con EMAIL_BACKEND de consola.')
        negocio, _ = Empresa.objects.get_or_create(nombre='DEMO — Cafetería ficticia', defaults={'tipo': 'NEGOCIO'})
        password = secrets.token_urlsafe(16)
        users = {}
        for rol, nombre in [('ADMIN', 'admin'), ('CLIENTE', 'visitante'), ('CAJERO', 'caja')]:
            email = f'{nombre}.points@example.test'
            user, creado = Usuario.objects.get_or_create(username=email, defaults={
                'email': email, 'rol': rol, 'first_name': f'Demo {nombre}',
                'email_verificado': True, 'empresa': negocio if rol == 'CAJERO' else None,
            })
            if creado:
                user.set_password(password)
                user.save()
                self.stdout.write(f'{email} / {password}')
            else:
                self.stdout.write(f'{email}: existente, conserva contraseña.')
            users[rol] = user
        for nombre, costo in [('DEMO — Café de cortesía', 100), ('DEMO — Merienda para compartir', 250)]:
            Recompensa.objects.get_or_create(nombre=nombre, negocio=negocio, defaults={
                'costo_puntos': costo, 'activo': True,
                'descripcion': 'Beneficio ficticio para demostrar el flujo. No válido en ningún negocio real.',
            })
        pedido, _ = Pedido.objects.get_or_create(codigo_retiro='DEMO0001', defaults={
            'cliente': users['CLIENTE'], 'empresa': negocio, 'total': '500.00', 'estado': 'LISTO_PARA_RECOGER',
        })
        validar_retiro(negocio, pedido.codigo_retiro)
        self.stdout.write(self.style.SUCCESS('Demo creada. Los códigos de acceso aparecen en la consola del backend.'))
