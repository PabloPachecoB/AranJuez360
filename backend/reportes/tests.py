from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from empresas.models import Empresa
from fidelizacion import services as fid
from fidelizacion.models import SolicitudPuntos, Visita
from usuarios.models import Usuario

BASE = "/api/v1/admin/reportes"


class ReportesTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)
        self.portero = Usuario.objects.create_user("guardia", password="x", rol=Usuario.Rol.PORTERO)
        self.cafe = Empresa.objects.create(nombre="Café", email_contacto="c@c.com")
        self.tienda = Empresa.objects.create(nombre="Tienda", email_contacto="t@t.com")
        self.dormida = Empresa.objects.create(nombre="Sin Movimiento", email_contacto="s@s.com")
        Empresa.objects.create(nombre="Oficina", tipo="OFICINA", email_contacto="o@o.com")
        self.cajero_cafe = Usuario.objects.create_user("cc", password="x", rol="CAJERO", empresa=self.cafe)
        self.cajero_tienda = Usuario.objects.create_user("ct", password="x", rol="CAJERO", empresa=self.tienda)
        self.ana = Usuario.objects.create_user("ana", password="x", rol="CLIENTE", first_name="Ana")
        self.beto = Usuario.objects.create_user("beto", password="x", rol="CLIENTE", first_name="Beto")
        self.client.force_authenticate(self.admin)

    def _compra(self, cliente, empresa, cajero, monto, aprobar=True):
        s = SolicitudPuntos.objects.create(cliente=cliente, empresa=empresa, nit="123", monto=Decimal(monto))
        if aprobar:
            fid.aprobar_solicitud(s.id, cajero)
        else:
            fid.rechazar_solicitud(s.id, cajero)
        return s

    def _visita(self, cliente, hace_dias=0, hora=None):
        token = fid.generar_qr_cliente(cliente)["token"]
        v = fid.registrar_visita(token, self.portero)
        if hace_dias or hora is not None:
            cuando = timezone.localtime() - timedelta(days=hace_dias)
            if hora is not None:
                cuando = cuando.replace(hour=hora)
            Visita.objects.filter(pk=v.pk).update(creado_en=cuando)
        return v

    def test_historial_cliente_ordena_tiendas_por_tickets(self):
        self._compra(self.ana, self.cafe, self.cajero_cafe, "20")
        SolicitudPuntos.objects.update(estado="APROBADA")  # libera la regla de "una pendiente"
        self._compra(self.ana, self.tienda, self.cajero_tienda, "300")
        self._compra(self.ana, self.cafe, self.cajero_cafe, "25")
        self._compra(self.ana, self.cafe, self.cajero_cafe, "15")
        self._compra(self.ana, self.tienda, self.cajero_tienda, "99", aprobar=False)
        self._visita(self.ana)

        data = self.client.get(f"{BASE}/clientes/{self.ana.id}/historial/").data
        self.assertEqual([t["nombre"] for t in data["tiendas"]], ["Café", "Tienda"])
        self.assertEqual(data["tiendas"][0]["tickets"], 3)
        self.assertEqual(data["tiendas"][0]["monto"], Decimal("60"))
        self.assertEqual(data["tiendas"][1]["tickets"], 1)  # el rechazado no cuenta
        self.assertEqual(data["totales"]["tickets"], 4)
        self.assertEqual(data["totales"]["tiendas_distintas"], 2)
        self.assertEqual(data["totales"]["visitas"], 1)
        self.assertEqual(data["cliente"]["puntos_saldo"], Decimal("360.75"))  # 360 por compras + 0,75 por visita

    def test_historial_solo_de_clientes(self):
        resp = self.client.get(f"{BASE}/clientes/{self.portero.id}/historial/")
        self.assertEqual(resp.status_code, 404)

    def test_resumen(self):
        self._compra(self.ana, self.cafe, self.cajero_cafe, "100")
        self._compra(self.beto, self.tienda, self.cajero_tienda, "50", aprobar=False)
        self._visita(self.ana)
        self._visita(self.beto)

        data = self.client.get(f"{BASE}/resumen/").data
        actual = data["actual"]
        self.assertEqual(actual["visitas"], 2)
        self.assertEqual(actual["clientes_distintos"], 2)
        self.assertEqual(actual["compras"], 1)
        self.assertEqual(actual["monto_total"], Decimal("100"))
        self.assertEqual(actual["puntos_entregados"], Decimal("101.5"))
        self.assertEqual(actual["solicitudes_rechazadas"], 1)
        self.assertEqual(data["puntos_en_circulacion"], Decimal("101.5"))

    def test_visitas_por_dia_y_horas_pico(self):
        self._visita(self.ana, hace_dias=1, hora=18)
        self._visita(self.beto, hace_dias=1, hora=18)
        self._visita(self.ana, hora=10)

        por_dia = self.client.get(f"{BASE}/visitas-por-dia/").data
        self.assertEqual([d["visitas"] for d in por_dia], [2, 1])
        horas = {h["hora"]: h["visitas"] for h in self.client.get(f"{BASE}/horas-pico/").data}
        self.assertEqual(horas[18], 2)

    def test_ranking_empresas_excluye_oficinas(self):
        self._compra(self.ana, self.cafe, self.cajero_cafe, "10")
        self._compra(self.beto, self.cafe, self.cajero_cafe, "10")
        self._compra(self.ana, self.tienda, self.cajero_tienda, "500", aprobar=False)

        ranking = self.client.get(f"{BASE}/empresas/ranking/").data
        self.assertEqual([e["nombre"] for e in ranking], ["Café", "Sin Movimiento", "Tienda"])
        self.assertEqual(ranking[0]["compras"], 2)
        self.assertEqual(ranking[0]["clientes"], 2)
        self.assertEqual(ranking[2]["tasa_rechazo"], 1.0)

    def test_empresas_sin_actividad(self):
        self._compra(self.ana, self.cafe, self.cajero_cafe, "10")
        nombres = [e["nombre"] for e in self.client.get(f"{BASE}/empresas/sin-actividad/").data]
        self.assertEqual(nombres, ["Sin Movimiento", "Tienda"])

    def test_clientes_frecuentes_y_dormidos(self):
        self._visita(self.ana)
        self._visita(self.ana, hace_dias=2)
        self._visita(self.beto, hace_dias=60)

        frecuentes = self.client.get(f"{BASE}/clientes/frecuentes/").data
        self.assertEqual([c["first_name"] for c in frecuentes], ["Ana"])
        self.assertEqual(frecuentes[0]["total_visitas"], 2)
        dormidos = self.client.get(f"{BASE}/clientes/dormidos/?dias=30").data
        self.assertEqual([c["first_name"] for c in dormidos], ["Beto"])

    def test_fecha_invalida(self):
        self.assertEqual(self.client.get(f"{BASE}/resumen/?desde=ayer").status_code, 400)

    def test_solo_admin(self):
        self.client.force_authenticate(self.portero)
        self.assertEqual(self.client.get(f"{BASE}/resumen/").status_code, 403)


class UsuariosAdminTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)
        Usuario.objects.create_user("p", password="x", rol="PORTERO", email="p@p.com", debe_cambiar_password=True)
        self.cliente = Usuario.objects.create_user("c", password="x", rol="CLIENTE", email="c@c.com")
        self.client.force_authenticate(self.admin)

    def test_filtrar_por_rol_y_sin_activar(self):
        data = self.client.get("/api/v1/admin/usuarios/?rol=portero").data["results"]
        self.assertEqual([u["email"] for u in data], ["p@p.com"])
        data = self.client.get("/api/v1/admin/usuarios/?sin_activar=true").data["results"]
        self.assertEqual(len(data), 1)

    def test_desactivar_y_no_cambiar_otros_campos(self):
        resp = self.client.patch(
            f"/api/v1/admin/usuarios/{self.cliente.id}/", {"is_active": False, "rol": "ADMIN"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.cliente.refresh_from_db()
        self.assertFalse(self.cliente.is_active)
        self.assertEqual(self.cliente.rol, "CLIENTE")

    def test_no_se_desactiva_a_si_mismo(self):
        resp = self.client.patch(f"/api/v1/admin/usuarios/{self.admin.id}/", {"is_active": False}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_usuarios_por_rol(self):
        data = {f["rol"]: f for f in self.client.get(f"{BASE}/usuarios-por-rol/").data}
        self.assertEqual(data["PORTERO"]["sin_activar"], 1)
        self.assertEqual(data["CLIENTE"]["activos"], 1)
