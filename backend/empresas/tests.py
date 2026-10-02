from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from usuarios.models import Usuario

from .models import Empresa, Producto


class AltaEmpresaTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)

    def _crear(self, **extra):
        self.client.force_authenticate(self.admin)
        datos = {"nombre": "Café Aranjuez", "tipo": "NEGOCIO", "email_contacto": "Cafe@Ejemplo.com"}
        datos.update(extra)
        return self.client.post("/api/v1/admin/empresas/", datos, format="json")

    def test_admin_crea_empresa_y_envia_credenciales(self):
        resp = self._crear()
        self.assertEqual(resp.status_code, 201, resp.data)

        usuario = Usuario.objects.get(username="cafe@ejemplo.com")
        self.assertEqual(usuario.rol, Usuario.Rol.NEGOCIO)
        self.assertTrue(usuario.debe_cambiar_password)
        self.assertEqual(usuario.empresa.nombre, "Café Aranjuez")

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["cafe@ejemplo.com"])
        self.assertIn("Contraseña temporal", mail.outbox[0].body)

    def test_oficina_recibe_rol_oficina(self):
        self._crear(nombre="Estudio Legal", tipo="OFICINA", email_contacto="legal@x.com")
        self.assertEqual(Usuario.objects.get(username="legal@x.com").rol, Usuario.Rol.OFICINA)

    def test_correo_duplicado_rechazado(self):
        self._crear()
        resp = self._crear(nombre="Otro")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Empresa.objects.count(), 1)

    def test_solo_admin_puede_crear(self):
        cliente = Usuario.objects.create_user("c", password="x", rol=Usuario.Rol.CLIENTE)
        self.client.force_authenticate(cliente)
        resp = self.client.post("/api/v1/admin/empresas/", {"nombre": "X", "email_contacto": "x@x.com"})
        self.assertEqual(resp.status_code, 403)

    def test_empresa_inicia_sesion_con_credenciales_del_correo(self):
        cache.clear()
        self._crear()
        password = mail.outbox[0].body.split("Contraseña temporal: ")[1].split("\n")[0]
        self.client.force_authenticate(None)
        resp = self.client.post(
            "/api/v1/auth/login/", {"email": "cafe@ejemplo.com", "password": password}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["paso"], "verificar_correo")  # primer ingreso: verifica el correo


class PanelEmpresaTests(APITestCase):
    def setUp(self):
        self.empresa = Empresa.objects.create(nombre="Tienda A", email_contacto="a@a.com")
        self.otra = Empresa.objects.create(nombre="Tienda B", email_contacto="b@b.com")
        self.usuario = Usuario.objects.create_user(
            "a@a.com", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.empresa
        )
        self.client.force_authenticate(self.usuario)

    def test_completa_ficha(self):
        resp = self.client.patch("/api/v1/mi-empresa/", {"piso": "2", "local": "15"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.empresa.refresh_from_db()
        self.assertEqual((self.empresa.piso, self.empresa.local), ("2", "15"))

    def test_no_puede_cambiar_su_nombre(self):
        self.client.patch("/api/v1/mi-empresa/", {"nombre": "Hackeado"}, format="json")
        self.empresa.refresh_from_db()
        self.assertEqual(self.empresa.nombre, "Tienda A")

    def test_reemplaza_horarios_de_la_semana(self):
        semana = [
            {"dia": 0, "abre": "10:00", "cierra": "21:00"},
            {"dia": 6, "cerrado": True},
        ]
        resp = self.client.put("/api/v1/mi-empresa/horarios/", semana, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(self.empresa.horarios.count(), 2)

    def test_horario_sin_horas_rechazado(self):
        resp = self.client.put("/api/v1/mi-empresa/horarios/", [{"dia": 0}], format="json")
        self.assertEqual(resp.status_code, 400)

    def test_productos_aislados_por_empresa(self):
        Producto.objects.create(empresa=self.otra, nombre="Ajeno", precio=10)
        resp = self.client.post(
            "/api/v1/mi-empresa/productos/", {"nombre": "Audífonos", "precio": "250"}, format="json"
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        listado = self.client.get("/api/v1/mi-empresa/productos/").data["results"]
        self.assertEqual([p["nombre"] for p in listado], ["Audífonos"])

    def test_codigo_qr_nfc(self):
        resp = self.client.get("/api/v1/mi-empresa/codigo/")
        self.assertEqual(resp.data["codigo"], self.empresa.codigo_fidelizacion)
        self.assertTrue(resp.data["enlace"].endswith(f"/puntos/{self.empresa.codigo_fidelizacion}"))

        nuevo = self.client.post("/api/v1/mi-empresa/codigo/regenerar/").data["codigo"]
        self.assertNotEqual(nuevo, resp.data["codigo"])


class OficinaTests(APITestCase):
    def setUp(self):
        self.oficina = Empresa.objects.create(nombre="Estudio", tipo="OFICINA", email_contacto="o@o.com")
        self.usuario = Usuario.objects.create_user(
            "o@o.com", password="x", rol=Usuario.Rol.OFICINA, empresa=self.oficina
        )
        self.client.force_authenticate(self.usuario)

    def test_oficina_edita_su_ficha(self):
        resp = self.client.patch("/api/v1/mi-empresa/", {"piso": "5"}, format="json")
        self.assertEqual(resp.status_code, 200)

    def test_oficina_no_tiene_qr_de_caja(self):
        self.assertEqual(self.client.get("/api/v1/mi-empresa/codigo/").status_code, 403)

    def test_oficina_no_atiende_caja(self):
        self.assertEqual(self.client.get("/api/v1/caja/solicitudes/").status_code, 403)
