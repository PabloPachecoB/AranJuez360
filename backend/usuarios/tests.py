import re
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import CodigoVerificacion, Usuario

REGISTRO = {
    "first_name": "Ana",
    "last_name": "Rojas",
    "email": "Ana@Correo.com",
    "celular": "71234567",
    "ci": "1234567-1a",
    "nit": "",
    "procedencia": "QUILLACOLLO",
    "password": "PaseoSeguro9",
    "password_confirmacion": "PaseoSeguro9",
    "acepta_terminos": True,
}


def _codigo_del_correo():
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


class RegistroTests(APITestCase):
    def setUp(self):
        cache.clear()  # reinicia el límite de intentos (throttling)

    def _registrar(self, **cambios):
        return self.client.post("/api/v1/auth/registro/", {**REGISTRO, **cambios}, format="json")

    def test_registro_envia_codigo_y_no_entrega_sesion(self):
        resp = self._registrar()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["paso"], "verificar_correo")
        self.assertNotIn("access", resp.data)

        user = Usuario.objects.get(username="ana@correo.com")
        self.assertEqual(user.ci, "1234567-1A")
        self.assertFalse(user.email_verificado)
        self.assertIsNotNone(user.acepto_terminos_en)
        self.assertIn("Verifica tu correo", mail.outbox[0].subject)

    def test_verificar_correo_entrega_tokens(self):
        desafio = self._registrar().data["desafio"]
        resp = self.client.post(
            "/api/v1/auth/verificar-codigo/", {"desafio": desafio, "codigo": _codigo_del_correo()}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIn("access", resp.data)
        self.assertTrue(resp.data["usuario"]["email_verificado"])

    def test_validaciones_del_formulario(self):
        casos = {
            "celular": "12345",
            "ci": "abc",
            "password": "corta1",
            "acepta_terminos": False,
        }
        for campo, valor in casos.items():
            cambios = {campo: valor}
            if campo == "password":
                cambios["password_confirmacion"] = valor
            resp = self._registrar(**cambios)
            self.assertEqual(resp.status_code, 400, campo)
            self.assertIn(campo, resp.data, campo)

    def test_password_sin_numeros_rechazada(self):
        resp = self._registrar(password="SoloLetrasAqui", password_confirmacion="SoloLetrasAqui")
        self.assertIn("password", resp.data)

    def test_confirmacion_distinta(self):
        resp = self._registrar(password_confirmacion="OtraCosa99")
        self.assertIn("password_confirmacion", resp.data)

    def test_ci_y_correo_unicos(self):
        self._registrar()
        self.assertIn("email", self._registrar(ci="7654321").data)
        self.assertIn("ci", self._registrar(email="otro@correo.com").data)

    def test_celular_con_prefijo(self):
        self._registrar(celular="+59171234567")
        self.assertEqual(Usuario.objects.get().celular, "71234567")


class LoginDosPasosTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = Usuario.objects.create_user(
            "ana@correo.com", email="ana@correo.com", password="PaseoSeguro9",
            rol=Usuario.Rol.CLIENTE, email_verificado=True,
        )

    def _login(self, password="PaseoSeguro9"):
        return self.client.post(
            "/api/v1/auth/login/", {"email": "ANA@correo.com", "password": password}, format="json"
        )

    def _verificar(self, desafio, codigo):
        return self.client.post("/api/v1/auth/verificar-codigo/", {"desafio": desafio, "codigo": codigo}, format="json")

    def test_login_pide_codigo_y_luego_entrega_tokens(self):
        resp = self._login()
        self.assertEqual(resp.data["paso"], "codigo_login")
        self.assertNotIn("access", resp.data)
        resp = self._verificar(resp.data["desafio"], _codigo_del_correo())
        self.assertEqual(resp.status_code, 200)
        self.assertIn("refresh", resp.data)

    def test_password_incorrecta(self):
        resp = self._login(password="mal")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_codigo_no_se_reutiliza(self):
        desafio = self._login().data["desafio"]
        codigo = _codigo_del_correo()
        self._verificar(desafio, codigo)
        self.assertEqual(self._verificar(desafio, codigo).status_code, 400)

    def test_intentos_limitados(self):
        desafio = self._login().data["desafio"]
        codigo = _codigo_del_correo()
        malo = "000000" if codigo != "000000" else "111111"
        for _ in range(5):
            self._verificar(desafio, malo)
        resp = self._verificar(desafio, codigo)  # ni el correcto sirve tras agotar intentos
        self.assertEqual(resp.status_code, 400)

    def test_codigo_vencido(self):
        desafio = self._login().data["desafio"]
        CodigoVerificacion.objects.update(expira_en=timezone.now() - timedelta(seconds=1))
        self.assertIn("venció", self._verificar(desafio, _codigo_del_correo()).data["detail"])

    def test_reenviar_respeta_espera_e_invalida_anterior(self):
        desafio = self._login().data["desafio"]
        self.assertEqual(
            self.client.post("/api/v1/auth/reenviar-codigo/", {"desafio": desafio}, format="json").status_code, 400
        )
        CodigoVerificacion.objects.update(creado_en=timezone.now() - timedelta(minutes=2))
        viejo = _codigo_del_correo()
        nuevo = self.client.post("/api/v1/auth/reenviar-codigo/", {"desafio": desafio}, format="json").data
        self.assertEqual(self._verificar(desafio, viejo).status_code, 400)
        self.assertEqual(self._verificar(nuevo["desafio"], _codigo_del_correo()).status_code, 200)

    def test_cuenta_sin_verificar_recibe_verificacion_de_correo(self):
        self.user.email_verificado = False
        self.user.save()
        self.assertEqual(self._login().data["paso"], "verificar_correo")

    def test_login_antiguo_sin_doble_factor_no_existe(self):
        resp = self.client.post("/auth/token/", {"username": "ana@correo.com", "password": "PaseoSeguro9"})
        self.assertEqual(resp.status_code, 404)


class CorreoSinDemoTests(SimpleTestCase):
    """El SMTP real no envía a los dominios inventados de las cuentas de demo."""

    @override_settings(EMAIL_DEMO_REDIRIGIR="")
    def test_omite_dominios_demo(self):
        from unittest import mock

        from django.core.mail import EmailMessage

        from paseo_erp.correo import SmtpSinDemoBackend

        backend = SmtpSinDemoBackend()
        with mock.patch("django.core.mail.backends.smtp.EmailBackend.send_messages", return_value=1) as smtp:
            solo_demo = EmailMessage("x", "y", to=["admin@paseo.bo"])
            self.assertEqual(backend.send_messages([solo_demo]), 0)
            smtp.assert_not_called()  # ni siquiera intenta conectarse

            mixto = EmailMessage("x", "y", to=["admin@paseo.bo", "real@gmail.com"])
            backend.send_messages([mixto])
            enviado = smtp.call_args.args[0][0]
            self.assertEqual(enviado.to, ["real@gmail.com"])

    def test_redirige_demo_si_esta_configurado(self):
        from unittest import mock

        from django.core.mail import EmailMessage

        from paseo_erp.correo import SmtpSinDemoBackend

        with override_settings(EMAIL_DEMO_REDIRIGIR="yo@gmail.com"),                 mock.patch("django.core.mail.backends.smtp.EmailBackend.send_messages", return_value=1) as smtp:
            SmtpSinDemoBackend().send_messages([EmailMessage("Tu código", "123", to=["admin@paseo.bo"])])
        enviado = smtp.call_args.args[0][0]
        self.assertEqual(enviado.to, ["yo@gmail.com"])
        self.assertEqual(enviado.subject, "[Demo: admin@paseo.bo] Tu código")



class ProcedenciaTests(APITestCase):
    """De dónde es el cliente: provincia de Cochabamba u Otro + ciudad."""

    def test_registro_otro_exige_ciudad(self):
        datos = {**REGISTRO, "procedencia": "OTRO", "ciudad_otra": ""}
        resp = self.client.post("/api/v1/auth/registro/", datos, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ciudad_otra", resp.data)
        datos["ciudad_otra"] = " Santa Cruz "
        self.assertEqual(self.client.post("/api/v1/auth/registro/", datos, format="json").status_code, 201)
        u = Usuario.objects.get(username="ana@correo.com")
        self.assertEqual((u.procedencia, u.ciudad_otra, u.procedencia_texto), ("OTRO", "Santa Cruz", "Otro: Santa Cruz"))

    def test_registro_sin_procedencia_rechazado(self):
        datos = {k: v for k, v in REGISTRO.items() if k != "procedencia"}
        resp = self.client.post("/api/v1/auth/registro/", datos, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("procedencia", resp.data)

    def test_provincia_limpia_la_ciudad(self):
        self.client.post("/api/v1/auth/registro/", {**REGISTRO, "ciudad_otra": "La Paz"}, format="json")
        u = Usuario.objects.get(username="ana@correo.com")
        self.assertEqual((u.procedencia, u.ciudad_otra, u.procedencia_texto), ("QUILLACOLLO", "", "Quillacollo"))

    def test_cliente_existente_completa_su_procedencia(self):
        u = Usuario.objects.create_user("viejo", password="x", rol=Usuario.Rol.CLIENTE)
        self.client.force_authenticate(u)
        self.assertEqual(self.client.get("/api/v1/auth/yo/").data["procedencia"], "")
        resp = self.client.patch("/api/v1/auth/yo/", {"procedencia": "CHAPARE"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["procedencia_texto"], "Chapare")

    def test_lista_de_opciones(self):
        opciones = self.client.get("/api/v1/auth/procedencias/").data
        self.assertEqual(len(opciones), 17)  # 16 provincias + Otro
        self.assertEqual(opciones[-1]["valor"], "OTRO")
