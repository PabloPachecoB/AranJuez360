"""Mensajes que dicen exactamente qué falta, y respuestas claras cuando hay o no hay tarjeta."""

from django.core import mail
from django.test import SimpleTestCase

from sorteo import services
from sorteo.models import CuentaFidelizacion

from .base import CODIGO_FIJO, SorteoBase


class MensajesTests(SimpleTestCase):
    def test_celular(self):
        casos = {
            "": "Escribe tu celular.",
            "   ": "Escribe tu celular.",
            "11": "Celular incompleto.",
            "7894563": "Celular incompleto.",
            "+54 11": "Celular incompleto.",
            "aa": "El celular solo lleva números.",
            "7123a567": "El celular solo lleva números.",
            "71+234567": "El celular solo lleva números.",
            "51234567": "El celular empieza con 6 o 7.",
            "3001234567": services.MENSAJE_CELULAR,   # completo pero de otro país y sin su código
        }
        for entrada, mensaje in casos.items():
            with self.subTest(entrada=entrada):
                self.assertIsNone(services.normalizar_celular(entrada))
                self.assertEqual(services.mensaje_celular(entrada), mensaje)

    def test_correo(self):
        casos = {
            "": "Escribe tu correo.",
            "juan": "Correo incompleto.",
            "juan@": "Correo incompleto.",
            "juan@gmail": "Correo incompleto.",
            "@gmail.com": "Correo incompleto.",
            "juan@gmail.": "Correo incompleto.",
            "ju an@gmail.com": "Revisa tu correo.",
            "juan@@gmail.com": "Revisa tu correo.",
        }
        for entrada, mensaje in casos.items():
            with self.subTest(entrada=entrada):
                self.assertIsNone(services.normalizar_correo(entrada))
                self.assertEqual(services.mensaje_correo(entrada), mensaje)

    def test_los_mensajes_son_cortos(self):
        for texto in ("11", "aa", "51234567", "3001234567", ""):
            self.assertLessEqual(len(services.mensaje_celular(texto)), 80)


class FormularioDeCrearTests(SorteoBase):
    def test_cada_campo_dice_que_le_falta(self):
        casos = [
            ({"celular": "11"}, "celular", "Celular incompleto."),
            ({"celular": "aa"}, "celular", "El celular solo lleva números."),
            ({"celular": "51234567"}, "celular", "El celular empieza con 6 o 7."),
            ({"celular": ""}, "celular", "Escribe tu celular."),
            ({"correo": "juan@"}, "correo", "Correo incompleto."),
            ({"correo": "juan@gmail"}, "correo", "Correo incompleto."),
            ({"correo": ""}, "correo", "Escribe tu correo."),
        ]
        for cambios, campo, mensaje in casos:
            with self.subTest(cambios=cambios):
                r = self.registrar(**cambios)
                self.assertEqual(r.status_code, 400)
                self.assertEqual(str(r.data[campo][0]), mensaje)
        self.assertEqual(CuentaFidelizacion.objects.count(), 0)

    def test_ya_tiene_tarjeta_con_ese_celular(self):
        self.activar(canal="CELULAR")
        self.envejecer("71234567")
        r = self.registrar(canal="CELULAR", correo="otra@ejemplo.com", nombres="Otra", apellidos="Persona")
        self.assertEqual((r.status_code, r.data["codigo"]), (409, "contacto_registrado"))
        self.assertEqual(r.data["detail"], "Ya tienes una tarjeta con ese celular. Entra a tu tarjeta.")
        self.assertEqual(CuentaFidelizacion.objects.count(), 1)


class EntrarTests(SorteoBase):
    def test_celular_valido_sin_tarjeta(self):
        r = self.post("recuperar/", {"contacto": "78945631"})
        self.assertEqual((r.status_code, r.data["codigo"], r.data["detail"]),
                         (404, "sin_tarjeta", "Celular inválido."))

    def test_correo_valido_sin_tarjeta(self):
        r = self.post("recuperar/", {"contacto": "alguien@gmail.com"})
        self.assertEqual((r.status_code, r.data["codigo"], r.data["detail"]),
                         (404, "sin_tarjeta", "Correo inválido."))

    def test_celular_de_otro_pais_sin_tarjeta(self):
        r = self.post("recuperar/", {"contacto": "+54 9 11 2345 6789"})
        self.assertEqual((r.status_code, r.data["detail"]), (404, "Celular inválido."))

    def test_una_cuenta_que_no_termino_de_crearse_no_cuenta_como_tarjeta(self):
        self.registrar()  # nunca escribió el código
        r = self.post("recuperar/", {"contacto": "maria@ejemplo.com"})
        self.assertEqual((r.status_code, r.data["codigo"]), (404, "sin_tarjeta"))

    def test_con_tarjeta_sigue_funcionando(self):
        original = self.activar()
        self.envejecer("maria@ejemplo.com")
        mail.outbox.clear()
        r = self.post("recuperar/", {"contacto": "maria@ejemplo.com"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        ok = self.post("verificar/", {"desafio": r.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(ok.data["tarjeta"]["codigo"], original.data["tarjeta"]["codigo"])
