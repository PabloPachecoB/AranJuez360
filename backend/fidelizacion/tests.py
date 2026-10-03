from datetime import timedelta
from decimal import Decimal

from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from empresas.models import Empresa
from usuarios.models import Usuario

from .models import (
    ConfiguracionPuntos,
    MovimientoPuntos,
    PuntoEscaneo,
    RangoCompra,
    Recompensa,
    SolicitudPuntos,
    Visita,
)


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
        self.assertEqual(resp.data["puntos"], "100.00")

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
        self.assertEqual(resp.data["puntos"], "149.98")  # 149.985 redondeado hacia abajo

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
        self.assertEqual(resp.data["puntos"], "20.00")
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, Decimal("20"))
        self.assertEqual(MovimientoPuntos.objects.get().tipo, MovimientoPuntos.Tipo.VISITA)

    def test_segunda_visita_en_24_horas_se_registra_sin_monedas(self):
        self._registrar(self._qr())
        resp = self._registrar(self._qr())
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["puntos"], "0.00")
        self.assertEqual(Visita.objects.count(), 2)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, Decimal("20"))

    def test_visita_vuelve_a_sumar_pasadas_las_horas(self):
        self._registrar(self._qr())
        Visita.objects.update(creado_en=timezone.now() - timedelta(hours=25))
        resp = self._registrar(self._qr())
        self.assertEqual(resp.data["puntos"], "20.00")
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, Decimal("40"))

    def test_monedas_por_visita_configurables(self):
        config = ConfiguracionPuntos.actual()
        config.puntos_por_visita = Decimal("5")
        config.horas_entre_visitas = 0
        config.save()
        for _ in range(2):
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


class MonederoTests(APITestCase):
    def setUp(self):
        from .models import Recompensa

        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)
        for nombre, costo in [("Cupón", 300), ("Café", 500), ("Premio", 1000)]:
            Recompensa.objects.create(nombre=nombre, costo_puntos=costo)
        Recompensa.objects.create(nombre="Inactiva", costo_puntos=350, activo=False)
        self.client.force_authenticate(self.cliente)

    def _monedero(self, saldo):
        Usuario.objects.filter(pk=self.cliente.pk).update(puntos_saldo=saldo)
        return self.client.get("/api/v1/puntos/monedero/").data

    def test_sin_puntos_apunta_a_la_primera_recompensa(self):
        data = self._monedero(0)
        self.assertEqual(data["siguiente"]["nombre"], "Cupón")
        self.assertEqual(data["siguiente"]["faltan_puntos"], 300)
        self.assertEqual(data["siguiente"]["progreso"], 0)
        self.assertEqual(data["recompensas_disponibles"], 0)

    def test_progreso_dentro_del_tramo_sin_bolivianos(self):
        config = ConfiguracionPuntos.actual()
        config.puntos_por_boliviano = Decimal("1.5")
        config.save()
        data = self._monedero(400)  # entre Cupón (300) y Café (500); ignora la inactiva
        self.assertEqual(data["siguiente"]["nombre"], "Café")
        self.assertEqual(data["siguiente"]["faltan_puntos"], 100)
        self.assertNotIn("faltan_bs", data["siguiente"])  # el cliente no ve la equivalencia en Bs
        self.assertNotIn("saldo_bs", data)
        self.assertEqual(data["siguiente"]["progreso"], 0.5)
        self.assertEqual(data["recompensas_disponibles"], 1)

    def test_con_todo_alcanzado_no_hay_siguiente(self):
        data = self._monedero(1200)
        self.assertIsNone(data["siguiente"])
        self.assertEqual(data["recompensas_disponibles"], 3)

    def test_catalogo_solo_activas(self):
        nombres = [r["nombre"] for r in self.client.get("/api/v1/puntos/recompensas/").data["results"]]
        self.assertEqual(nombres, ["Cupón", "Café", "Premio"])


class EscaneoYRangosTests(APITestCase):
    """NFC/QR de la puerta y de actividades, y monedas de compra por rangos."""

    def setUp(self):
        self.cliente = Usuario.objects.create_user("ana", password="x", first_name="Ana", rol=Usuario.Rol.CLIENTE)
        self.puerta = PuntoEscaneo.objects.create(nombre="Puerta", tipo="ENTRADA", monedas=Decimal("0.75"))
        self.juegos = PuntoEscaneo.objects.create(nombre="Juegos", tipo="ACTIVIDAD", monedas=Decimal("0.50"))
        self.empresa = Empresa.objects.create(nombre="Café X", email_contacto="cafe@x.com")
        self.client.force_authenticate(self.cliente)

    def _escanear(self, punto):
        return self.client.post("/api/v1/puntos/escanear/", {"codigo": punto.codigo}, format="json")

    def _saldo(self):
        self.cliente.refresh_from_db()
        return self.cliente.puntos_saldo

    def test_puerta_da_075_una_vez_cada_24_horas(self):
        resp = self._escanear(self.puerta)
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["monedas"], Decimal("0.75"))
        self.assertEqual(self._saldo(), Decimal("0.75"))
        self.assertEqual(Visita.objects.get().punto, self.puerta)

        otra = self._escanear(self.puerta)
        self.assertEqual(otra.status_code, 400)
        self.assertIn("Ya registraste tu visita", otra.data["detail"])
        self.assertEqual(self._saldo(), Decimal("0.75"))

        Visita.objects.update(creado_en=timezone.now() - timedelta(hours=25))
        self.assertEqual(self._escanear(self.puerta).status_code, 201)
        self.assertEqual(self._saldo(), Decimal("1.50"))

    def test_actividad_tiene_su_propia_espera(self):
        self.assertEqual(self._escanear(self.juegos).status_code, 201)
        self.assertEqual(self._escanear(self.juegos).status_code, 400)
        # La espera de juegos no bloquea la visita de la puerta.
        self.assertEqual(self._escanear(self.puerta).status_code, 201)
        self.assertEqual(self._saldo(), Decimal("1.25"))
        self.assertEqual(MovimientoPuntos.objects.filter(tipo="ACTIVIDAD").count(), 1)

    def test_resolver_codigo_distingue_compra_y_puntos(self):
        resp = self.client.get(f"/api/v1/puntos/codigo/{self.empresa.codigo_fidelizacion}/")
        self.assertEqual(resp.data["tipo"], "COMPRA")
        self.assertEqual(resp.data["empresa"]["nombre"], "Café X")
        resp = self.client.get(f"/api/v1/puntos/codigo/{self.juegos.codigo}/")
        self.assertEqual(resp.data["tipo"], "ACTIVIDAD")
        self.assertEqual(resp.data["punto"]["nombre"], "Juegos")
        self.assertEqual(self.client.get("/api/v1/puntos/codigo/nada/").status_code, 400)

    def test_codigo_de_caja_no_se_cobra_como_escaneo(self):
        resp = self.client.post("/api/v1/puntos/escanear/", {"codigo": self.empresa.codigo_fidelizacion}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_compra_usa_rangos_de_monto(self):
        from .services import calcular_puntos

        RangoCompra.objects.create(monto_minimo=0, monto_maximo=Decimal("49.99"), monedas=2)
        RangoCompra.objects.create(monto_minimo=50, monto_maximo=None, monedas=6)
        config = ConfiguracionPuntos.actual()
        self.assertEqual(calcular_puntos(Decimal("20"), config), 2)
        self.assertEqual(calcular_puntos(Decimal("49.99"), config), 2)
        self.assertEqual(calcular_puntos(Decimal("50"), config), 6)
        self.assertEqual(calcular_puntos(Decimal("900"), config), 6)

    def test_admin_crea_punto_con_enlace_nfc(self):
        admin = Usuario.objects.create_user("adm", password="x", rol=Usuario.Rol.ADMIN)
        self.client.force_authenticate(admin)
        resp = self.client.post("/api/v1/admin/puntos-escaneo/",
                                {"nombre": "Bowling", "tipo": "ACTIVIDAD", "monedas": "0.50"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertTrue(resp.data["enlace"].startswith("paseo360://f/"))
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get("/api/v1/admin/puntos-escaneo/").status_code, 403)



class CanjeTests(APITestCase):
    def setUp(self):
        self.cliente = Usuario.objects.create_user("c", password="x", rol=Usuario.Rol.CLIENTE)
        Usuario.objects.filter(pk=self.cliente.pk).update(puntos_saldo=Decimal("60"))
        self.parqueo = Recompensa.objects.create(nombre="Parqueo", costo_puntos=50, categoria="PARQUEO")
        self.client.force_authenticate(self.cliente)

    def test_canjear_descuenta_y_da_codigo(self):
        resp = self.client.post(f"/api/v1/puntos/recompensas/{self.parqueo.id}/canjear/")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(len(resp.data["codigo"]), 8)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.puntos_saldo, Decimal("10"))
        self.assertEqual(MovimientoPuntos.objects.get(tipo="CANJE").puntos, Decimal("-50"))
        self.assertEqual(len(self.client.get("/api/v1/puntos/canjes/").data["results"]), 1)
        # Ya no alcanza para otro.
        self.assertEqual(self.client.post(f"/api/v1/puntos/recompensas/{self.parqueo.id}/canjear/").status_code, 400)


class RecompensasNegocioTests(APITestCase):
    """Escala 1000 monedas = Bs 30, catálogo de cada negocio y validación de cupones."""

    def setUp(self):
        self.cafe = Empresa.objects.create(nombre="Café X", email_contacto="cafe@x.com")
        self.tienda = Empresa.objects.create(nombre="Tienda Y", email_contacto="t@y.com")
        self.dueno = Usuario.objects.create_user("dueno", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.cafe)
        self.cajero = Usuario.objects.create_user("caja", password="x", rol=Usuario.Rol.CAJERO, empresa=self.cafe)
        self.otro = Usuario.objects.create_user("otro", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.tienda)
        self.admin = Usuario.objects.create_user("adm", password="x", rol=Usuario.Rol.ADMIN)
        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)
        Usuario.objects.filter(pk=self.cliente.pk).update(puntos_saldo=Decimal("2000"))

    def test_negocio_publica_producto_con_costo_sugerido(self):
        self.client.force_authenticate(self.dueno)
        resp = self.client.post("/api/v1/mi-empresa/recompensas/", {
            "nombre": "Capuchino gratis", "categoria": "PRODUCTO", "costo_puntos": "760", "valor_bs": "22",
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["costo_sugerido"], Decimal("810"))  # 22 / 0,03 × 1,10 → decenas
        self.assertEqual(Recompensa.objects.get().empresa, self.cafe)
        conv = self.client.get("/api/v1/puntos/conversion/").data
        self.assertEqual(conv["valor_moneda_bs"], Decimal("0.0300"))
        # Un negocio no puede publicar parqueo ni cine (son del Paseo).
        resp = self.client.post("/api/v1/mi-empresa/recompensas/",
                                {"nombre": "Parqueo", "categoria": "PARQUEO", "costo_puntos": "10"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_cliente_no_ve_bolivianos(self):
        Recompensa.objects.create(nombre="Capuchino", costo_puntos=760, valor_bs=22, empresa=self.cafe)
        self.client.force_authenticate(self.cliente)
        item = self.client.get("/api/v1/puntos/recompensas/").data["results"][0]
        self.assertNotIn("valor_bs", item)
        self.assertNotIn("costo_sugerido", item)
        self.assertEqual(self.client.get("/api/v1/puntos/conversion/").status_code, 404)

    def test_validar_cupon_solo_el_negocio_del_premio_y_una_vez(self):
        premio = Recompensa.objects.create(nombre="Capuchino", costo_puntos=760, empresa=self.cafe)
        self.client.force_authenticate(self.cliente)
        codigo = self.client.post(f"/api/v1/puntos/recompensas/{premio.id}/canjear/").data["codigo"]

        self.client.force_authenticate(self.otro)  # otro negocio
        self.assertEqual(self.client.get(f"/api/v1/canjes/validar/{codigo}/").status_code, 400)

        self.client.force_authenticate(self.cajero)
        ver = self.client.get(f"/api/v1/canjes/validar/{codigo.lower()}/")
        self.assertEqual(ver.data["recompensa_nombre"], "Capuchino")
        self.assertEqual(ver.data["estado"], "ACTIVO")
        usar = self.client.post(f"/api/v1/canjes/validar/{codigo}/")
        self.assertEqual(usar.data["estado"], "USADO")
        otra = self.client.post(f"/api/v1/canjes/validar/{codigo}/")
        self.assertIn("ya se entregó", otra.data["detail"])

        self.client.force_authenticate(self.dueno)
        recibidos = self.client.get("/api/v1/mi-empresa/canjes/").data["results"]
        self.assertEqual([c["codigo"] for c in recibidos], [codigo])

    def test_premios_del_paseo_los_valida_el_admin(self):
        parqueo = Recompensa.objects.create(nombre="Parqueo", categoria="PARQUEO", costo_puntos=150)
        self.client.force_authenticate(self.cliente)
        codigo = self.client.post(f"/api/v1/puntos/recompensas/{parqueo.id}/canjear/").data["codigo"]
        self.client.force_authenticate(self.dueno)
        self.assertEqual(self.client.post(f"/api/v1/canjes/validar/{codigo}/").status_code, 400)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f"/api/v1/canjes/validar/{codigo}/").data["estado"], "USADO")
