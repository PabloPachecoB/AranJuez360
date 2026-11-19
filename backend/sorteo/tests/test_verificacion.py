from datetime import timedelta

from django.core import mail
from django.test import override_settings
from django.utils import timezone

from sorteo.models import CodigoTarjeta, CuentaFidelizacion, DesafioContacto, EventoAuditoria

from .base import CODIGO_FIJO, SorteoBase


class VerificacionTests(SorteoBase):
    def test_codigo_correcto_activa_la_cuenta_y_emite_la_tarjeta(self):
        resp = self.activar()
        cuenta = CuentaFidelizacion.objects.get()
        self.assertEqual(cuenta.estado, CuentaFidelizacion.Estado.ACTIVA)
        self.assertIsNotNone(cuenta.correo_verificado_en)
        self.assertIsNone(cuenta.celular_verificado_en)  # solo se verifica el contacto elegido
        self.assertEqual(CodigoTarjeta.objects.filter(cuenta=cuenta, activo=True).count(), 1)
        self.assertRegex(resp.data["tarjeta"]["codigo"], r"^PA-[A-Z2-9]{6}$")
        self.assertTrue(resp.data["sesion"])
        self.assertTrue(EventoAuditoria.objects.filter(cuenta=cuenta, tipo="VERIFICACION").exists())

    def test_verificar_por_celular_marca_solo_el_celular(self):
        self.activar(canal="CELULAR")
        cuenta = CuentaFidelizacion.objects.get()
        self.assertIsNotNone(cuenta.celular_verificado_en)
        self.assertIsNone(cuenta.correo_verificado_en)

    def test_el_codigo_solo_sirve_una_vez(self):
        resp = self.registrar()
        datos = {"desafio": resp.data["desafio"], "codigo": CODIGO_FIJO}
        self.assertEqual(self.post("verificar/", datos).status_code, 200)
        otra = self.post("verificar/", datos)
        self.assertEqual(otra.status_code, 400)
        self.assertEqual(otra.data["codigo"], "desafio_invalido")

    def test_codigo_incorrecto_resta_intentos_y_el_quinto_invalida(self):
        resp = self.registrar()
        malo = {"desafio": resp.data["desafio"], "codigo": "000000"}
        for restantes in (4, 3, 2, 1):
            r = self.post("verificar/", malo)
            self.assertEqual((r.status_code, r.data["codigo"]), (400, "codigo_incorrecto"))
            self.assertIn(f"Te quedan {restantes}", r.data["detail"])
        ultimo = self.post("verificar/", malo)
        self.assertEqual(ultimo.data["codigo"], "demasiados_intentos")
        # ya no sirve ni el código correcto
        bueno = self.post("verificar/", {"desafio": resp.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(bueno.data["codigo"], "codigo_agotado")  # ya no sirve, pero se puede pedir otro
        self.assertEqual(CuentaFidelizacion.objects.get().estado, CuentaFidelizacion.Estado.PENDIENTE)

    def test_codigo_vencido(self):
        resp = self.registrar()
        DesafioContacto.objects.update(expira_en=timezone.now() - timedelta(seconds=1))
        r = self.post("verificar/", {"desafio": resp.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual((r.status_code, r.data["codigo"]), (400, "codigo_vencido"))
        self.assertEqual(CuentaFidelizacion.objects.get().estado, CuentaFidelizacion.Estado.PENDIENTE)

    def test_formato_del_codigo(self):
        resp = self.registrar()
        r = self.post("verificar/", {"desafio": resp.data["desafio"], "codigo": "12"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("codigo", r.data)

    def test_reenviar_espera_60_segundos_y_el_codigo_anterior_deja_de_servir(self):
        resp = self.registrar()
        pronto = self.post("reenviar/", {"desafio": resp.data["desafio"]})
        self.assertEqual((pronto.status_code, pronto.data["codigo"]), (429, "espera_reenvio"))

        self.envejecer("maria@ejemplo.com")
        nuevo = self.post("reenviar/", {"desafio": resp.data["desafio"]})
        self.assertEqual(nuevo.status_code, 200, nuevo.data)
        self.assertNotEqual(nuevo.data["desafio"], resp.data["desafio"])
        self.assertEqual(len(mail.outbox), 2)
        viejo = self.post("verificar/", {"desafio": resp.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(viejo.data["codigo"], "codigo_agotado")
        self.assertEqual(self.post("verificar/", {"desafio": nuevo.data["desafio"], "codigo": CODIGO_FIJO}).status_code, 200)

    @override_settings(SORTEO_ENVIOS_DIA=3)
    def test_tope_diario_de_codigos_por_contacto(self):
        resp = self.registrar()
        for _ in range(2):
            self.envejecer("maria@ejemplo.com")
            resp = self.post("reenviar/", {"desafio": resp.data["desafio"]})
            self.assertEqual(resp.status_code, 200)
        self.envejecer("maria@ejemplo.com")
        r = self.post("reenviar/", {"desafio": resp.data["desafio"]})
        self.assertEqual((r.status_code, r.data["codigo"]), (429, "limite_envios"))

    def test_contacto_verificado_en_otra_cuenta_mientras_tanto(self):
        # Una cuenta pendiente con un correo que otra cuenta ya verificó (p. ej. bloqueada): no se lo puede quitar.
        self.activar()
        CuentaFidelizacion.objects.update(estado=CuentaFidelizacion.Estado.BLOQUEADA)
        self.envejecer("maria@ejemplo.com")
        resp = self.registrar(nombres="Otra", apellidos="Persona")  # la dueña está bloqueada: se crea otra cuenta
        self.assertEqual(CuentaFidelizacion.objects.count(), 2)
        r = self.post("verificar/", {"desafio": resp.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual((r.status_code, r.data["codigo"]), (409, "contacto_en_uso"))
        self.assertEqual(CuentaFidelizacion.objects.filter(correo_verificado_en__isnull=False).count(), 1)
        self.assertEqual(CuentaFidelizacion.objects.get(nombres="Otra").estado, CuentaFidelizacion.Estado.PENDIENTE)
