from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch
from django.core.cache import cache
from rest_framework.test import APITestCase
from empresas.models import Empresa
from usuarios.models import Usuario
from pedidos.models import Pedido
from pedidos.services import validar_retiro
from .models import Recompensa, Cupon, MovimientoPuntos


class CanjesTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.negocio = Empresa.objects.create(nombre='Negocio de prueba')
        self.otro = Empresa.objects.create(nombre='Otro negocio')
        self.cliente = Usuario.objects.create_user('cliente', rol='CLIENTE', puntos_saldo=150)
        self.caja = Usuario.objects.create_user('caja', rol='CAJERO', empresa=self.negocio)
        self.caja_otra = Usuario.objects.create_user('otra', rol='CAJERO', empresa=self.otro)
        self.premio = Recompensa.objects.create(nombre='Beneficio de prueba', costo_puntos=100, empresa=self.negocio)
        self.client.force_authenticate(self.cliente)

    def canjear(self, clave=None):
        return self.client.post(f'/api/v1/recompensas/{self.premio.pk}/canjear/', {'clave_operacion': str(clave or uuid4())}, format='json')

    def test_reintento_debita_una_vez_incluso_si_se_pausa(self):
        clave = uuid4()
        uno = self.canjear(clave)
        self.assertEqual(uno.status_code, 201, uno.data)
        self.premio.activo = False
        self.premio.save()
        dos = self.canjear(clave)
        self.assertEqual(dos.status_code, 200, dos.data)
        self.assertEqual(uno.data['codigo'], dos.data['codigo'])
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 50)
        self.assertEqual(MovimientoPuntos.objects.count(), 1)

    def test_saldo_insuficiente_no_crea_otro_cupon(self):
        self.canjear()
        self.assertEqual(self.canjear().status_code, 400)
        self.assertEqual(Cupon.objects.count(), 1)

    def test_otro_comercio_no_puede_consultar_ni_validar(self):
        codigo = self.canjear().data['codigo']
        self.client.force_authenticate(self.caja_otra)
        for accion in ['consultar', 'validar']:
            self.assertEqual(self.client.post(f'/api/v1/cupones/{accion}/', {'codigo': codigo}).status_code, 400)
        self.assertEqual(Cupon.objects.get().estado, 'activo')

    def test_validacion_unica_sin_nuevo_debito(self):
        codigo = self.canjear().data['codigo']
        self.client.force_authenticate(self.caja)
        self.assertEqual(self.client.post('/api/v1/cupones/consultar/', {'codigo': codigo}).status_code, 200)
        self.assertEqual(Cupon.objects.get().estado, 'activo')
        self.assertEqual(self.client.post('/api/v1/cupones/validar/', {'codigo': codigo}).status_code, 200)
        self.assertEqual(self.client.post('/api/v1/cupones/validar/', {'codigo': codigo}).status_code, 400)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 50)

    def test_snapshot_y_privacidad(self):
        self.canjear()
        self.premio.nombre = 'Cambio posterior'
        self.premio.save()
        self.assertEqual(Cupon.objects.get().nombre, 'Beneficio de prueba')
        otro = Usuario.objects.create_user('segundo', rol='CLIENTE')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get('/api/v1/cupones/').data['count'], 0)

    def test_cliente_no_administra_beneficios(self):
        self.assertEqual(self.client.patch(f'/api/v1/recompensas/{self.premio.pk}/', {'activo': False}).status_code, 403)

    def test_negocio_inactivo_no_emite(self):
        self.negocio.activo = False
        self.negocio.save()
        self.assertEqual(self.canjear().status_code, 400)
        self.assertEqual(Cupon.objects.count(), 0)

    def test_entrega_acredita_una_vez(self):
        pedido = Pedido.objects.create(cliente=self.cliente, empresa=self.negocio, total='25.90', estado='LISTO_PARA_RECOGER')
        validar_retiro(self.negocio, pedido.codigo_retiro)
        validar_retiro(self.negocio, pedido.codigo_retiro)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, Decimal("175.90"))
        self.assertEqual(MovimientoPuntos.objects.filter(pedido=pedido).count(), 1)

    def test_fallo_abono_revierte_entrega(self):
        pedido = Pedido.objects.create(cliente=self.cliente, empresa=self.negocio, total='25', estado='LISTO_PARA_RECOGER')
        with patch('fidelizacion.canjes.acreditar_pedido', side_effect=RuntimeError('simulado')):
            with self.assertRaises(RuntimeError):
                validar_retiro(self.negocio, pedido.codigo_retiro)
        pedido.refresh_from_db()
        self.assertEqual(pedido.estado, 'LISTO_PARA_RECOGER')
        self.assertIsNone(pedido.entregado_en)

    def test_sin_autenticacion_no_accede(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/cupones/').status_code, 401)


    def test_misma_operacion_desde_app_y_web_no_duplica_cargo(self):
        clave = uuid4()
        self.premio.costo_puntos = Decimal("1.25")
        self.premio.save()
        app = self.client.post(f"/api/v1/puntos/recompensas/{self.premio.pk}/canjear/",
                               {"clave_operacion": str(clave)}, format="json")
        web = self.canjear(clave)
        self.assertEqual(app.status_code, 201, app.data)
        self.assertEqual(web.status_code, 200, web.data)
        self.assertEqual(app.data["codigo"], web.data["codigo"])
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, Decimal("148.75"))
        self.assertEqual(MovimientoPuntos.objects.count(), 1)

    def test_caja_sincroniza_estado_y_conserva_condiciones_en_app(self):
        response = self.canjear()
        self.premio.nombre = "Otro premio"
        self.premio.save()
        self.client.force_authenticate(self.caja)
        self.assertEqual(self.client.post('/api/v1/cupones/validar/', {'codigo': response.data['codigo']}).status_code, 200)
        self.client.force_authenticate(self.cliente)
        canje = self.client.get('/api/v1/puntos/canjes/').data['results'][0]
        self.assertEqual(canje['estado'], 'USADO')
        self.assertEqual(canje['recompensa_nombre'], 'Beneficio de prueba')

    def test_beneficio_global_se_valida_en_administracion(self):
        self.premio.empresa = None
        self.premio.save()
        response = self.canjear()
        self.assertEqual(response.status_code, 201, response.data)
        self.client.force_authenticate(self.caja)
        self.assertEqual(self.client.post('/api/v1/cupones/validar/', {'codigo': response.data['codigo']}).status_code, 400)
        admin = Usuario.objects.create_user('admin', rol='ADMIN')
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post('/api/v1/cupones/validar/', {'codigo': response.data['codigo']}).status_code, 200)

    def test_pedido_utiliza_rangos_de_main(self):
        from .models import RangoCompra
        RangoCompra.objects.create(monto_minimo=0, monto_maximo=None, monedas=Decimal('2.50'))
        pedido = Pedido.objects.create(cliente=self.cliente, empresa=self.negocio, total='25.90', estado='LISTO_PARA_RECOGER')
        validar_retiro(self.negocio, pedido.codigo_retiro)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, Decimal('152.50'))
