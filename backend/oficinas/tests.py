from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from empresas.models import Empresa
from usuarios.models import Usuario

from .models import Invitacion


class VisitasOficinaTests(APITestCase):
    def setUp(self):
        self.oficina = Empresa.objects.create(
            nombre="Estudio Legal", tipo=Empresa.Tipo.OFICINA, email_contacto="legal@x.com", piso="5", local="502"
        )
        self.otra = Empresa.objects.create(nombre="Dental", tipo=Empresa.Tipo.OFICINA, email_contacto="d@x.com")
        self.resp = Usuario.objects.create_user("ofi", password="x", rol=Usuario.Rol.OFICINA, empresa=self.oficina)
        self.cliente = Usuario.objects.create_user(
            "ana", password="x", first_name="Ana", last_name="Rojas", email="ana@x.com",
            rol=Usuario.Rol.CLIENTE, ci="1234567", celular="71234567",
        )
        self.portero = Usuario.objects.create_user("port", password="x", rol=Usuario.Rol.PORTERO)
        self.hoy = timezone.localdate()

    def _solicitar(self, fecha=None, oficina=None):
        self.client.force_authenticate(self.cliente)
        return self.client.post("/api/v1/oficinas/visitas/", {
            "oficina": (oficina or self.oficina).id, "fecha": (fecha or self.hoy).isoformat(),
            "hora": "10:30", "motivo": "Consulta",
        }, format="json")

    def test_flujo_solicitud_aprobacion_e_ingreso(self):
        resp = self._solicitar()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["estado"], "PENDIENTE")
        self.assertIsNone(resp.data["qr"])  # sin aprobar no hay QR
        self.assertEqual(resp.data["visitante_nombre"], "Ana Rojas")
        inv_id, codigo = resp.data["id"], resp.data["codigo"]

        self.client.force_authenticate(self.portero)
        self.assertEqual(self.client.get(f"/api/v1/porteria/invitaciones/{codigo}/").status_code, 400)

        self.client.force_authenticate(self.resp)
        bandeja = self.client.get("/api/v1/mi-oficina/visitas/?estado=pendiente").data["results"]
        self.assertEqual([v["id"] for v in bandeja], [inv_id])
        ok = self.client.post(f"/api/v1/mi-oficina/visitas/{inv_id}/aprobar/")
        self.assertEqual(ok.data["estado"], "APROBADA")

        self.client.force_authenticate(self.cliente)
        mia = self.client.get("/api/v1/oficinas/visitas/").data["results"][0]
        self.assertEqual(mia["qr"], f"paseo360://inv/{codigo}")

        self.client.force_authenticate(self.portero)
        self.assertEqual(self.client.get(f"/api/v1/porteria/invitaciones/{codigo.lower()}/").data["visitante_ci"], "1234567")
        ingreso = self.client.post(f"/api/v1/porteria/invitaciones/{codigo}/ingreso/")
        self.assertEqual(ingreso.status_code, 201)
        self.assertEqual(Invitacion.objects.get().estado, "USADA")
        otra_vez = self.client.post(f"/api/v1/porteria/invitaciones/{codigo}/ingreso/")
        self.assertIn("ya se usó", otra_vez.data["detail"])

    def test_invitacion_de_otro_dia_no_entra_hoy(self):
        inv = Invitacion.objects.create(
            oficina=self.oficina, visitante_nombre="X", fecha=self.hoy + timedelta(days=1),
            origen="INVITACION", estado="APROBADA",
        )
        self.client.force_authenticate(self.portero)
        resp = self.client.get(f"/api/v1/porteria/invitaciones/{inv.codigo}/")
        self.assertIn("no para hoy", resp.data["detail"])

    def test_oficina_invita_sin_app_con_whatsapp(self):
        self.client.force_authenticate(self.resp)
        resp = self.client.post("/api/v1/mi-oficina/visitas/", {
            "visitante_nombre": "Luis Paz", "visitante_celular": "76543210", "fecha": self.hoy.isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["estado"], "APROBADA")
        self.assertFalse(resp.data["tiene_app"])
        self.assertTrue(resp.data["whatsapp"].startswith("https://wa.me/59176543210?text="))
        pagina = self.client.get(f"/invitacion/{resp.data['codigo']}/")
        self.assertEqual(pagina.status_code, 200)
        self.assertContains(pagina, "Luis Paz")
        self.assertContains(pagina, "data:image/png;base64,")

    def test_oficina_invita_cliente_con_app_por_correo(self):
        self.client.force_authenticate(self.resp)
        resp = self.client.post("/api/v1/mi-oficina/visitas/", {"cliente": "ANA@x.com", "fecha": self.hoy.isoformat()},
                                format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertTrue(resp.data["tiene_app"])
        self.client.force_authenticate(self.cliente)
        self.assertEqual(len(self.client.get("/api/v1/oficinas/visitas/").data["results"]), 1)

    def test_sin_app_requiere_celular(self):
        self.client.force_authenticate(self.resp)
        resp = self.client.post("/api/v1/mi-oficina/visitas/", {"visitante_nombre": "Luis", "fecha": self.hoy.isoformat()},
                                format="json")
        self.assertEqual(resp.status_code, 400)

    def test_oficina_no_ve_ni_aprueba_visitas_de_otra(self):
        inv_id = self._solicitar(oficina=self.otra).data["id"]
        self.client.force_authenticate(self.resp)
        self.assertEqual(self.client.get("/api/v1/mi-oficina/visitas/").data["results"], [])
        self.assertEqual(self.client.post(f"/api/v1/mi-oficina/visitas/{inv_id}/aprobar/").status_code, 400)

    def test_fecha_pasada_y_pagina_de_pendiente(self):
        self.assertEqual(self._solicitar(fecha=self.hoy - timedelta(days=1)).status_code, 400)
        codigo = self._solicitar().data["codigo"]
        self.assertEqual(self.client.get(f"/invitacion/{codigo}/").status_code, 404)  # aún no aprobada

    def test_cliente_cancela(self):
        inv_id = self._solicitar().data["id"]
        resp = self.client.post(f"/api/v1/oficinas/visitas/{inv_id}/cancelar/")
        self.assertEqual(resp.data["estado"], "CANCELADA")
