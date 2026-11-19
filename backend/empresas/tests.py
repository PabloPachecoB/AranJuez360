from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from usuarios.models import Usuario

from .models import Categoria, Empresa, InvitacionEmpresa, Producto


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
        self.assertEqual(resp.data["enlace"], f"paseo360://f/{self.empresa.codigo_fidelizacion}")

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


class InvitacionEmpresaTests(APITestCase):
    """Alta por invitación: solo quien recibe el correo del admin crea su cuenta."""

    def setUp(self):
        self.Usuario = Usuario
        self.admin = Usuario.objects.create_user("adm", password="x", rol=Usuario.Rol.ADMIN)
        self.cat = Categoria.objects.create(nombre="Salud")

    def _invitar(self, **extra):
        self.client.force_authenticate(self.admin)
        datos = {"email": "Duena@Dental.com", "tipo": "OFICINA", "nombre_sugerido": "Dental Sonrisa",
                 "categoria": self.cat.id, "mensaje": "Bienvenidos", **extra}
        return self.client.post("/api/v1/admin/invitaciones-empresa/", datos, format="json")

    def _token(self):
        return InvitacionEmpresa.objects.latest("creado_en").token

    def _aceptar(self, token, **extra):
        self.client.force_authenticate(None)
        datos = {"nombre_empresa": "Consultorio Dental Sonrisa", "first_name": "Rosa", "last_name": "Vargas",
                 "password": "Sonrisa2026!", "password_confirmacion": "Sonrisa2026!", **extra}
        return self.client.post(f"/api/v1/auth/invitacion-empresa/{token}/", datos, format="json")

    def test_flujo_invitar_y_aceptar(self):
        resp = self._invitar()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["email"], "duena@dental.com")
        self.assertEqual(len(mail.outbox), 1)
        token = self._token()
        self.assertIn(f"/activar/{token}", mail.outbox[0].body)

        info = self.client.get(f"/api/v1/auth/invitacion-empresa/{token}/").data
        self.assertEqual(info["tipo"], "OFICINA")
        self.assertEqual(info["nombre_sugerido"], "Dental Sonrisa")

        ok = self._aceptar(token)
        self.assertEqual(ok.status_code, 201, ok.data)
        usuario = self.Usuario.objects.get(username="duena@dental.com")
        self.assertEqual(usuario.rol, "OFICINA")
        self.assertTrue(usuario.email_verificado)
        self.assertTrue(usuario.check_password("Sonrisa2026!"))
        self.assertEqual(usuario.empresa.nombre, "Consultorio Dental Sonrisa")
        self.assertEqual(usuario.empresa.categoria, self.cat)
        # El enlace no sirve dos veces.
        self.assertIn("ya se usó", self._aceptar(token).data["detail"])

    def test_contrasena_debil_y_distinta(self):
        self._invitar()
        token = self._token()
        self.assertIn("password", self._aceptar(token, password="123", password_confirmacion="123").data)
        self.assertIn("password_confirmacion", self._aceptar(token, password_confirmacion="otra").data)

    def test_vencida_anulada_y_reenvio(self):
        inv_id = self._invitar().data["id"]
        token = self._token()
        InvitacionEmpresa.objects.filter(pk=inv_id).update(expira_en=timezone.now() - timedelta(seconds=1))
        self.assertIn("venció", self.client.get(f"/api/v1/auth/invitacion-empresa/{token}/").data["detail"])

        self.client.force_authenticate(self.admin)
        nueva = self.client.post(f"/api/v1/admin/invitaciones-empresa/{inv_id}/reenviar/")
        self.assertEqual(nueva.status_code, 200)
        self.assertNotEqual(self._token(), token)  # el enlace viejo deja de servir
        self.assertEqual(self.client.get(f"/api/v1/auth/invitacion-empresa/{token}/").status_code, 400)

        self.client.force_authenticate(self.admin)
        self.client.post(f"/api/v1/admin/invitaciones-empresa/{inv_id}/anular/")
        self.assertIn("no es válida", self._aceptar(self._token()).data["detail"])

    def test_encargado_extra_se_une_a_empresa_existente(self):
        empresa = Empresa.objects.create(nombre="Café X", email_contacto="cafe@x.com")
        self._invitar(email="encargado@cafe.com", empresa=empresa.id, tipo="OFICINA")
        ok = self._aceptar(self._token(), nombre_empresa="")
        self.assertEqual(ok.status_code, 201, ok.data)
        usuario = self.Usuario.objects.get(username="encargado@cafe.com")
        self.assertEqual(usuario.empresa, empresa)
        self.assertEqual(usuario.rol, "NEGOCIO")  # el tipo sale de la empresa, no de lo enviado
        self.assertEqual(Empresa.objects.count(), 1)

    def test_no_invita_correo_existente_y_solo_admin(self):
        self.Usuario.objects.create_user("ya@x.com", email="ya@x.com", password="x", rol="CLIENTE")
        self.assertEqual(self._invitar(email="ya@x.com").status_code, 400)
        cliente = self.Usuario.objects.get(username="ya@x.com")
        self.client.force_authenticate(cliente)
        resp = self.client.post("/api/v1/admin/invitaciones-empresa/", {"email": "z@x.com"}, format="json")
        self.assertEqual(resp.status_code, 403)


class AutorregistroNegocioTests(APITestCase):
    """Autorregistro de la rama reto3-paseoya: apagado salvo que se habilite."""

    def setUp(self):
        self.cat = Categoria.objects.create(nombre="Comida")
        self.datos = {"nombre": "Salteñas Doña Ana", "tipo": "EMPRENDIMIENTO", "categoria": self.cat.id,
                      "email": "ana@saltenas.com", "password": "Cochabamba77x", "password_confirmacion": "Cochabamba77x"}

    def test_apagado_por_defecto_solo_invitacion(self):
        resp = self.client.post("/api/v1/auth/registro-negocio/", self.datos, format="json")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("invitación", resp.data["detail"])
        self.assertFalse(Empresa.objects.filter(nombre="Salteñas Doña Ana").exists())

    def test_habilitado_crea_negocio_y_pide_codigo(self):
        from django.test import override_settings

        with override_settings(PERMITIR_AUTORREGISTRO_EMPRESAS=True):
            resp = self.client.post("/api/v1/auth/registro-negocio/", self.datos, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["paso"], "verificar_correo")
        usuario = Usuario.objects.get(username="ana@saltenas.com")
        self.assertEqual(usuario.rol, "NEGOCIO")
        self.assertEqual(usuario.empresa.tipo, "EMPRENDIMIENTO")


class DirectorioPublicoTests(APITestCase):
    """Directorio de la app: negocios y emprendimientos con su ficha completa."""

    def setUp(self):
        from datetime import time

        from fidelizacion.models import Recompensa

        from .models import Horario, Oferta

        comida = Categoria.objects.create(nombre="Comida")
        moda = Categoria.objects.create(nombre="Moda")
        self.cafe = Empresa.objects.create(nombre="Café X", categoria=comida, piso="1", email_contacto="c@x.com")
        self.ropa = Empresa.objects.create(nombre="Moda Y", categoria=moda, piso="2", email_contacto="m@y.com")
        self.empre = Empresa.objects.create(nombre="Dulces Z", tipo="EMPRENDIMIENTO", categoria=comida,
                                            email_contacto="d@z.com")
        Empresa.objects.create(nombre="Oficina", tipo="OFICINA", email_contacto="o@o.com")
        Empresa.objects.create(nombre="Cerrada", activo=False, email_contacto="x@x.com")
        Producto.objects.create(empresa=self.ropa, nombre="Camisa de lino", precio=180, seccion="Camisas")
        hoy = timezone.localdate()
        Oferta.objects.create(empresa=self.cafe, titulo="2x1", inicio=hoy, fin=hoy)
        for dia in range(7):
            Horario.objects.create(empresa=self.cafe, dia=dia, abre=time(0, 0), cierra=time(23, 59))
        Recompensa.objects.create(nombre="Capuchino", costo_puntos=760, valor_bs=22, empresa=self.cafe)

    def _nombres(self, query=""):
        data = self.client.get(f"/api/v1/empresas/?page_size=200{query}").data
        return [e["nombre"] for e in data["results"]]

    def test_filtros(self):
        self.assertEqual(self._nombres("&tipo=NEGOCIO,EMPRENDIMIENTO"), ["Café X", "Dulces Z", "Moda Y"])
        self.assertEqual(self._nombres("&rubro=comida"), ["Café X", "Dulces Z"])
        self.assertEqual(self._nombres("&tipo=NEGOCIO&excluir_rubro=comida"), ["Moda Y"])
        self.assertEqual(self._nombres("&piso=2"), ["Moda Y"])
        self.assertEqual(self._nombres("&buscar=lino"), ["Moda Y"])  # busca también en productos

    def test_ficha_completa(self):
        lista = self.client.get("/api/v1/empresas/?tipo=NEGOCIO&rubro=comida").data["results"][0]
        self.assertEqual(lista["ofertas_vigentes"], 1)
        self.assertTrue(lista["abierto_ahora"])
        ficha = self.client.get(f"/api/v1/empresas/{self.cafe.id}/").data
        self.assertEqual([r["nombre"] for r in ficha["recompensas"]], ["Capuchino"])
        self.assertNotIn("valor_bs", ficha["recompensas"][0])
        self.assertIsNone(self.client.get(f"/api/v1/empresas/{self.ropa.id}/").data["abierto_ahora"])


class MarketplaceTests(APITestCase):
    def test_catalogo_publico_filtra_por_rubro_y_trae_datos_del_local(self):
        comida = Categoria.objects.create(nombre="Comida")
        pizzas = Empresa.objects.create(nombre="Almacén de Pizzas", categoria=comida, piso="3", email_contacto="a@a.com")
        ropa = Empresa.objects.create(nombre="Moda", email_contacto="m@m.com")
        Producto.objects.create(empresa=pizzas, nombre="Pizza personal", precio=38, seccion="Pizzas")
        Producto.objects.create(empresa=pizzas, nombre="Vieja", precio=10, activo=False)
        Producto.objects.create(empresa=ropa, nombre="Camisa", precio=180)

        data = self.client.get("/api/v1/productos/?rubro=comida").data["results"]
        self.assertEqual([p["nombre"] for p in data], ["Pizza personal"])
        self.assertEqual((data[0]["empresa_nombre"], data[0]["piso"]), ("Almacén de Pizzas", "3"))
        self.assertEqual(len(self.client.get("/api/v1/productos/?buscar=camisa").data["results"]), 1)
