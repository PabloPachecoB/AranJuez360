from decimal import Decimal

from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from empresas.models import Empresa
from usuarios.models import Usuario

from .models import ConfiguracionPuntos, MovimientoPuntos, SolicitudPuntos, Visita


class FlujoPuntosTests(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Café X", email_contacto="cafe@x.com")
        self.otra = Empresa.objects.create(nombre="Tienda Y", email_contacto="y@y.com")
        self.cajero = Usuario.objects.create_user(
            "caja", password="x", rol=Usuario.Rol.CAJERO, empresa=self.empresa
        )
        self.cajero_otra = Usuario.objects.create_user(
            "caja2", password="x", rol=Usuario.Rol.CAJERO, empresa=self.otra
        )
        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)

    def _solicitar(self, monto="100.00", codigo=None):
        self.client.force_authenticate(self.cliente)
        return self.client.post(
            "/api/v1/puntos/solicitudes/",
            {"codigo": codigo or self.empresa.codigo_fidelizacion, "nit": "1234567", "monto": monto},
            format="json",
        )

    def test_escaneo_muestra_empresa(self):
        self.client.force_authenticate(self.cliente)
        resp = self.client.get(f"/api/v1/puntos/empresa/{self.empresa.codigo_fidelizacion}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["nombre"], "Café X")

    def test_codigo_invalido(self):
        self.client.force_authenticate(self.cliente)
        resp = self.client.get("/api/v1/puntos/empresa/no-existe/")
        self.assertEqual(resp.status_code, 400)

    def test_flujo_completo_aprobacion(self):
        resp = self._solicitar()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["estado"], "PENDIENTE")
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 0)  # nada hasta que caja apruebe

        self.client.force_authenticate(self.cajero)
        pendientes = self.client.get("/api/v1/caja/solicitudes/?estado=pendiente").data["results"]
        self.assertEqual(len(pendientes), 1)

        resp = self.client.post(f"/api/v1/caja/solicitudes/{pendientes[0]['id']}/aprobar/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["puntos"], 100)

        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 100)
        self.assertEqual(MovimientoPuntos.objects.get().puntos, 100)

    def test_no_se_aprueba_dos_veces(self):
        sid = self._solicitar().data["id"]
        self.client.force_authenticate(self.cajero)
        self.client.post(f"/api/v1/caja/solicitudes/{sid}/aprobar/")
        resp = self.client.post(f"/api/v1/caja/solicitudes/{sid}/aprobar/")
        self.assertEqual(resp.status_code, 400)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 100)

    def test_rechazo_no_suma_puntos(self):
        sid = self._solicitar().data["id"]
        self.client.force_authenticate(self.cajero)
        resp = self.client.post(
            f"/api/v1/caja/solicitudes/{sid}/rechazar/", {"motivo": "Monto no coincide"}, format="json"
        )
        self.assertEqual(resp.data["estado"], "RECHAZADA")
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 0)

    def test_caja_de_otra_empresa_no_ve_ni_aprueba(self):
        sid = self._solicitar().data["id"]
        self.client.force_authenticate(self.cajero_otra)
        self.assertEqual(self.client.get("/api/v1/caja/solicitudes/").data["count"], 0)
        resp = self.client.post(f"/api/v1/caja/solicitudes/{sid}/aprobar/")
        self.assertEqual(resp.status_code, 404)

    def test_una_pendiente_por_empresa(self):
        self._solicitar()
        resp = self._solicitar()
        self.assertEqual(resp.status_code, 400)

    def test_limite_diario(self):
        config = ConfiguracionPuntos.actual()
        config.solicitudes_diarias_por_empresa = 1
        config.save()
        sid = self._solicitar().data["id"]
        SolicitudPuntos.objects.filter(pk=sid).update(estado="RECHAZADA")
        self.assertEqual(self._solicitar().status_code, 400)

    def test_monto_maximo(self):
        self.assertEqual(self._solicitar(monto="999999").status_code, 400)

    def test_empresa_inactiva(self):
        self.empresa.activo = False
        self.empresa.save()
        self.assertEqual(self._solicitar().status_code, 400)

    def test_regla_de_puntos_configurable(self):
        config = ConfiguracionPuntos.actual()
        config.puntos_por_boliviano = Decimal("1.5")
        config.save()
        sid = self._solicitar(monto="99.99").data["id"]
        self.client.force_authenticate(self.cajero)
        resp = self.client.post(f"/api/v1/caja/solicitudes/{sid}/aprobar/")
        self.assertEqual(resp.data["puntos"], 149)  # 149.985 redondeado hacia abajo

    def test_qr_de_oficina_no_suma_puntos(self):
        oficina = Empresa.objects.create(nombre="Estudio", tipo="OFICINA", email_contacto="o@o.com")
        self.assertEqual(self._solicitar(codigo=oficina.codigo_fidelizacion).status_code, 400)

    def test_cajero_no_puede_crear_solicitudes(self):
        self.client.force_authenticate(self.cajero)
        resp = self.client.post(
            "/api/v1/puntos/solicitudes/",
            {"codigo": self.empresa.codigo_fidelizacion, "nit": "1", "monto": "10"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)


class VisitasTests(APITestCase):
    def setUp(self):
        self.portero = Usuario.objects.create_user("guardia", password="x", rol=Usuario.Rol.PORTERO)
        self.cliente = Usuario.objects.create_user(
            "cli", password="x", rol=Usuario.Rol.CLIENTE, first_name="Ana"
        )

    def _qr(self):
        self.client.force_authenticate(self.cliente)
        return self.client.get("/api/v1/puntos/mi-qr/").data["token"]

    def _registrar(self, token):
        self.client.force_authenticate(self.portero)
        return self.client.post("/api/v1/porteria/visitas/", {"token": token}, format="json")

    def test_portero_registra_visita_y_suma_punto(self):
        resp = self._registrar(self._qr())
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["cliente_nombre"], "Ana")
        self.assertEqual(resp.data["puntos"], 1)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 1)
        self.assertEqual(MovimientoPuntos.objects.get().tipo, MovimientoPuntos.Tipo.VISITA)

    def test_segunda_visita_del_dia_se_registra_sin_puntos(self):
        self._registrar(self._qr())
        resp = self._registrar(self._qr())
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["puntos"], 0)
        self.assertEqual(Visita.objects.count(), 2)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 1)

    def test_puntos_por_visita_configurables(self):
        config = ConfiguracionPuntos.actual()
        config.puntos_por_visita = 5
        config.visitas_con_puntos_por_dia = 2
        config.save()
        for _ in range(3):
            self._registrar(self._qr())
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, 10)

    @override_settings(QR_CLIENTE_VIGENCIA_SEGUNDOS=-1)
    def test_qr_vencido(self):
        resp = self._registrar(self._qr())
        self.assertEqual(resp.status_code, 400)
        self.assertIn("venció", resp.data["detail"])

    def test_qr_alterado(self):
        self.assertEqual(self._registrar(self._qr() + "x").status_code, 400)

    def test_solo_portero_registra(self):
        token = self._qr()
        self.client.force_authenticate(self.cliente)
        resp = self.client.post("/api/v1/porteria/visitas/", {"token": token}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_portero_ve_sus_visitas_de_hoy(self):
        self._registrar(self._qr())
        self.assertEqual(self.client.get("/api/v1/porteria/visitas/").data["count"], 1)


class PorterosAdminTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)
        self.client.force_authenticate(self.admin)

    def test_admin_crea_portero_y_envia_credenciales(self):
        resp = self.client.post(
            "/api/v1/admin/porteros/",
            {"first_name": "Juan", "last_name": "Perez", "email": "Juan@Paseo.bo"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        portero = Usuario.objects.get(username="juan@paseo.bo")
        self.assertEqual(portero.rol, Usuario.Rol.PORTERO)
        self.assertTrue(portero.debe_cambiar_password)
        self.assertEqual(mail.outbox[0].to, ["juan@paseo.bo"])

    def test_admin_desactiva_portero(self):
        portero = Usuario.objects.create_user("g", password="x", rol=Usuario.Rol.PORTERO, email="g@g.com")
        resp = self.client.patch(f"/api/v1/admin/porteros/{portero.pk}/", {"is_active": False}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        portero.refresh_from_db()
        self.assertFalse(portero.is_active)
