from empresas.models import Empresa
from sorteo.models import CuentaFidelizacion
from usuarios.models import Usuario

from .base import SorteoBase


class ResolverTests(SorteoBase):
    def setUp(self):
        super().setUp()
        self.activar()
        self.cuenta = CuentaFidelizacion.objects.get()
        self.codigo = self.cuenta.codigos.get(activo=True).codigo
        self.ruta = f"resolver/{self.codigo}/"

        self.empresa = Empresa.objects.create(nombre="Café X", email_contacto="cafe@x.com")
        crear = Usuario.objects.create_user
        self.negocio = crear("negocio", password="x", rol=Usuario.Rol.NEGOCIO, empresa=self.empresa)
        self.cajero = crear("caja", password="x", rol=Usuario.Rol.CAJERO, empresa=self.empresa)
        self.admin = crear("admin", password="x", rol=Usuario.Rol.ADMIN)
        self.cliente = crear("cli", password="x", rol=Usuario.Rol.CLIENTE)
        self.portero = crear("guardia", password="x", rol=Usuario.Rol.PORTERO)
        oficina = Empresa.objects.create(nombre="Estudio", tipo="OFICINA", email_contacto="o@o.com")
        self.oficina = crear("oficina", password="x", rol=Usuario.Rol.OFICINA, empresa=oficina)

    def resolver(self, usuario, ruta=None):
        self.client.force_authenticate(usuario)
        return self.client.get(f"{self.URL}{ruta or self.ruta}")

    def test_negocio_y_cajero_reciben_solo_lo_minimo(self):
        for usuario in (self.negocio, self.cajero):
            with self.subTest(rol=usuario.rol):
                resp = self.resolver(usuario)
                self.assertEqual(resp.status_code, 200, resp.data)
                self.assertEqual(resp.data["nombre"], "María G. P.")
                self.assertEqual(resp.data["referencia"], str(self.cuenta.referencia))
                self.assertEqual(set(resp.data), {"referencia", "nombre", "campania_activa"})
                texto = str(resp.data).lower()
                for prohibido in ("@", "71234567", "gómez", "pérez", "correo", "celular"):
                    self.assertNotIn(prohibido, texto)

    def test_el_codigo_resuelve_la_misma_cuenta_que_se_registro(self):
        resp = self.resolver(self.admin)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["id"], self.cuenta.pk)
        self.assertEqual(resp.data["correo"], "maria@ejemplo.com")
        self.assertEqual(resp.data["apellidos"], "Gómez Pérez")
        self.assertTrue(resp.data["correo_verificado"])
        self.assertFalse(resp.data["celular_verificado"])

    def test_admin_no_expone_la_cuenta_mediante_la_referencia_interna(self):
        self.assertNotEqual(self.resolver(self.negocio).data["referencia"], str(self.cuenta.pk))

    def test_anonimo_recibe_401(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"{self.URL}{self.ruta}").status_code, 401)

    def test_roles_sin_permiso_reciben_403(self):
        for usuario in (self.cliente, self.oficina, self.portero):
            with self.subTest(rol=usuario.rol):
                self.assertEqual(self.resolver(usuario).status_code, 403)

    def test_el_titular_de_una_tarjeta_no_puede_resolver_codigos(self):
        self.client.force_authenticate(None)
        otra = self.activar(correo="otra@ejemplo.com", celular="61234567")
        r = self.client.get(f"{self.URL}{self.ruta}", **self.auth(otra.data["sesion"]))
        self.assertEqual(r.status_code, 401)  # la cabecera Tarjeta no autentica en rutas de caja

    def test_negocio_con_empresa_inactiva_recibe_403(self):
        self.empresa.activo = False
        self.empresa.save()
        for usuario in (self.negocio, self.cajero):
            self.assertEqual(self.resolver(usuario).status_code, 403)

    def test_negocio_sin_empresa_recibe_403(self):
        huerfano = Usuario.objects.create_user("sin", password="x", rol=Usuario.Rol.NEGOCIO)
        self.assertEqual(self.resolver(huerfano).status_code, 403)

    def test_codigo_inexistente_o_con_mala_forma_responde_igual(self):
        for ruta in ("resolver/PA-AAAAAA/", "resolver/basura/", "resolver/pa-1/"):
            with self.subTest(ruta=ruta):
                resp = self.resolver(self.negocio, ruta)
                self.assertEqual((resp.status_code, resp.data["codigo"]), (404, "qr_invalido"))

    def test_acepta_minusculas(self):
        self.assertEqual(self.resolver(self.cajero, f"resolver/{self.codigo.lower()}/").status_code, 200)

    def test_cuenta_bloqueada_no_resuelve(self):
        CuentaFidelizacion.objects.update(estado=CuentaFidelizacion.Estado.BLOQUEADA)
        resp = self.resolver(self.negocio)
        self.assertEqual((resp.status_code, resp.data["codigo"]), (404, "qr_invalido"))

    def test_campania_inactiva_se_informa(self):
        self.campania.estado = self.campania.Estado.CERRADA
        self.campania.save()
        self.assertFalse(self.resolver(self.negocio).data["campania_activa"])


class RevocarPorApiTests(SorteoBase):
    def setUp(self):
        super().setUp()
        resp = self.activar()
        self.sesion = resp.data["sesion"]
        self.viejo = resp.data["tarjeta"]["codigo"]
        self.cuenta = CuentaFidelizacion.objects.get()
        self.admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)
        self.negocio = Usuario.objects.create_user(
            "negocio", password="x", rol=Usuario.Rol.NEGOCIO,
            empresa=Empresa.objects.create(nombre="Café X", email_contacto="cafe@x.com"),
        )

    def revocar(self, usuario, **datos):
        self.client.force_authenticate(usuario)
        return self.client.post(
            f"{self.URL}admin/cuentas/{self.cuenta.pk}/revocar-codigo/", datos or {"motivo": "Perdió el celular"},
            format="json",
        )

    def test_admin_revoca_y_el_codigo_viejo_deja_de_resolver(self):
        resp = self.revocar(self.admin)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertNotEqual(resp.data["codigo"], self.viejo)
        self.client.force_authenticate(self.negocio)
        self.assertEqual(self.client.get(f"{self.URL}resolver/{self.viejo}/").status_code, 404)
        self.assertEqual(self.client.get(f"{self.URL}resolver/{resp.data['codigo']}/").status_code, 200)

    def test_solo_el_admin_puede_revocar(self):
        self.assertEqual(self.revocar(self.negocio).status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(f"{self.URL}admin/cuentas/{self.cuenta.pk}/revocar-codigo/", {}, format="json").status_code, 401)

    def test_pide_motivo(self):
        self.assertEqual(self.revocar(self.admin, motivo="x").status_code, 400)

    def test_cuenta_inexistente(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"{self.URL}admin/cuentas/99999/revocar-codigo/", {"motivo": "prueba"}, format="json")
        self.assertEqual(r.status_code, 404)
