from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from empresas.models import Empresa
from fidelizacion.models import MovimientoPuntos, SolicitudPuntos, Visita
from usuarios.models import Usuario
from .geografia import mapa_clientes


class GeografiaTests(TestCase):
    def setUp(self):
        self.hoy = timezone.localdate()
        self.desde = self.hoy - timedelta(days=29)
        self.empresa = Empresa.objects.create(nombre='Tienda mapa', email_contacto='mapa@example.test')
        self.cliente = Usuario.objects.create_user('mapa-a', rol='CLIENTE', procedencia='CERCADO',
            fecha_nacimiento=date(self.hoy.year - 25, self.hoy.month, min(self.hoy.day, 28)))

    def compra(self, cliente, monto, estado='APROBADA', antes=False):
        s = SolicitudPuntos.objects.create(cliente=cliente, empresa=self.empresa, monto=Decimal(monto), nit='123', estado=estado)
        if antes:
            SolicitudPuntos.objects.filter(pk=s.pk).update(creado_en=timezone.now() - timedelta(days=40))
        return s

    def datos(self):
        return mapa_clientes(self.desde, self.hoy)

    def test_suma_solo_compras_aprobadas_del_periodo_sin_multiplicar_visitas(self):
        self.compra(self.cliente, '100.20')
        self.compra(self.cliente, '49.80')
        self.compra(self.cliente, '900', estado='RECHAZADA')
        self.compra(self.cliente, '800', estado='PENDIENTE')
        self.compra(self.cliente, '500', antes=True)
        portero = Usuario.objects.create_user('mapa-portero', rol='PORTERO')
        Visita.objects.create(cliente=self.cliente, portero=portero)
        Visita.objects.create(cliente=self.cliente, portero=portero)
        data = self.datos()
        cercado = next(p for p in data['provincias'] if p['clave'] == 'CERCADO')
        self.assertEqual((cercado['clientes'], cercado['clientes_con_compras'], cercado['compras'], cercado['visitas']), (1,1,2,2))
        self.assertEqual(cercado['monto'], Decimal('150'))
        self.assertEqual(cercado['consumo_por_comprador'], Decimal('150'))
        self.assertEqual(cercado['por_edad'][0]['nombre'], '25 a 34')
        self.assertEqual(cercado['por_edad'][0]['monto'], Decimal('150'))
        self.assertEqual(len(data['provincias']), 16)

    def test_ciudades_normalizadas_con_mismas_metricas_y_edades_desconocidas(self):
        a = Usuario.objects.create_user('mapa-b', rol='CLIENTE', procedencia='OTRO', ciudad_otra='  La   Paz ')
        b = Usuario.objects.create_user('mapa-c', rol='CLIENTE', procedencia='OTRO', ciudad_otra='la paz')
        self.compra(a, '120')
        self.compra(b, '30')
        c = self.datos()['ciudades'][0]
        self.assertEqual(len(self.datos()['ciudades']), 1)
        self.assertEqual((c['nombre'], c['clientes'], c['compras']), ('La Paz', 2, 2))
        self.assertEqual(c['consumo_por_comprador'], Decimal('75'))
        self.assertIsNone(c['edad_promedio'])
        self.assertEqual(c['por_edad'][0]['nombre'], 'Sin dato')

    def test_sin_datos_no_se_inventa_provincia_ni_edad(self):
        Usuario.objects.create_user('mapa-sin', rol='CLIENTE')
        Usuario.objects.create_user('mapa-sin-ciudad', rol='CLIENTE', procedencia='OTRO')
        Usuario.objects.create_user('mapa-admin', rol='ADMIN', procedencia='CERCADO')
        data = self.datos()
        self.assertEqual(data['sin_procedencia']['clientes'], 1)
        self.assertEqual(data['ciudades'][0]['nombre'], 'Ciudad sin indicar')
        self.assertEqual(sum(p['clientes'] for p in data['provincias']), 1)

    def test_endpoint_solo_admin_y_valida_fechas(self):
        client = APIClient()
        url = '/api/v1/admin/reportes/clientes/mapa/'
        self.assertIn(client.get(url).status_code, (401,403))
        client.force_authenticate(self.cliente)
        self.assertEqual(client.get(url).status_code, 403)
        admin = Usuario.objects.create_user('mapa-autorizado', rol='ADMIN')
        client.force_authenticate(admin)
        self.assertEqual(client.get(url).status_code, 200)
        self.assertEqual(client.get(url, {'desde':'error'}).status_code, 400)
        self.assertEqual(client.get(url, {'desde':'2026-10-04','hasta':'2026-10-01'}).status_code, 400)

    def test_frecuencia_ocupaciones_y_puntos_reales(self):
        self.cliente.ocupacion = 'PROFESIONAL'
        self.cliente.puntos_saldo = Decimal('75.50')
        self.cliente.save()
        otro = Usuario.objects.create_user('mapa-universitario', rol='CLIENTE', procedencia='CERCADO',
                                           ocupacion='UNIVERSITARIO', puntos_saldo=Decimal('20.25'))
        ahora = timezone.now()
        for dias in (12, 6, 0):
            s = self.compra(self.cliente, '50')
            SolicitudPuntos.objects.filter(pk=s.pk).update(creado_en=ahora-timedelta(days=dias))
        self.compra(otro, '10')
        MovimientoPuntos.objects.create(cliente=self.cliente, tipo='COMPRA', puntos=Decimal('35.25'))
        MovimientoPuntos.objects.create(cliente=self.cliente, tipo='CANJE', puntos=Decimal('-10'))
        viejo = MovimientoPuntos.objects.create(cliente=self.cliente, tipo='COMPRA', puntos=Decimal('90'))
        MovimientoPuntos.objects.filter(pk=viejo.pk).update(creado_en=ahora-timedelta(days=45))
        c = next(p for p in self.datos()['provincias'] if p['clave'] == 'CERCADO')
        self.assertEqual(c['compradores_recurrentes'], 1)
        self.assertEqual(c['dias_entre_compras'], 6)
        self.assertEqual(c['compras_por_comprador'], 2)
        self.assertEqual(c['puntos_saldo'], Decimal('95.75'))
        self.assertEqual(c['puntos_ganados'], Decimal('35.25'))
        ocupaciones = {o['nombre']:o for o in c['por_ocupacion']}
        self.assertEqual(ocupaciones['Profesional']['compras'], 3)
        self.assertEqual(ocupaciones['Profesional']['puntos_saldo'], Decimal('75.50'))
        self.assertIsNone(ocupaciones['Universitario/a']['dias_entre_compras'])
        self.assertEqual(sum(e['puntos_saldo'] for e in c['por_edad']), c['puntos_saldo'])

    def test_sin_compras_no_infiere_frecuencia(self):
        c = next(p for p in self.datos()['provincias'] if p['clave'] == 'CERCADO')
        self.assertIsNone(c['dias_entre_compras'])
        self.assertEqual(c['compradores_recurrentes'], 0)
        self.assertEqual(c['por_ocupacion'][0]['nombre'], 'Sin dato')
