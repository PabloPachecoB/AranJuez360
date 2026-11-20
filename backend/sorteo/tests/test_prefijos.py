"""Celulares de otros países: se aceptan con su código de país; los de Bolivia siguen igual."""

from django.test import SimpleTestCase

from sorteo import canales, services
from sorteo.models import CuentaFidelizacion

from .base import CODIGO_FIJO, SorteoBase


class NormalizarCelularTests(SimpleTestCase):
    def test_bolivia_se_guarda_sin_codigo_de_pais(self):
        for entrada in ("71234567", "+59171234567", "591 71234567", "0059171234567", "+591 712-34567", "(591) 7123.4567"):
            with self.subTest(entrada=entrada):
                self.assertEqual(services.normalizar_celular(entrada), "71234567")

    def test_otros_paises_se_guardan_con_su_codigo(self):
        casos = {
            "+54 9 11 2345 6789": "+5491123456789",   # Argentina
            "+56 9 1234 5678": "+56912345678",        # Chile
            "+1 (305) 555-0199": "+13055550199",      # EE. UU.
            "0034 612 345 678": "+34612345678",       # España, con 00
            "+55 11 91234-5678": "+5511912345678",    # Brasil
            "+51987654321": "+51987654321",           # Perú
        }
        for entrada, esperado in casos.items():
            with self.subTest(entrada=entrada):
                self.assertEqual(services.normalizar_celular(entrada), esperado)

    def test_invalidos(self):
        malos = (
            "", "abc", "7123456", "51234567",       # corto; Bolivia que no empieza con 6 o 7
            "+591 51234567", "+591 7123",           # Bolivia con código pero mal número
            "3001234567",                           # otro país sin código: no se sabe cuál es
            "+1234567", "+1234567890123456",        # menos de 8 o más de 15 dígitos
            "+0123456789", "+54 abc 1234", "++5491123456789", "+", "００５４",
        )
        for malo in malos:
            with self.subTest(malo=malo):
                self.assertIsNone(services.normalizar_celular(malo))

    def test_recuperar_reconoce_el_celular_de_otro_pais(self):
        self.assertEqual(services.normalizar_contacto("+54 9 11 2345 6789"), ("CELULAR", "+5491123456789"))
        self.assertEqual(services.normalizar_contacto("71234567"), ("CELULAR", "71234567"))

    def test_el_enmascarado_conserva_el_codigo_de_pais(self):
        self.assertEqual(canales.enmascarar("CELULAR", "+5491123456789"), "+54••••••89")
        self.assertEqual(canales.enmascarar("CELULAR", "71234567"), "••••••67")


class RegistroInternacionalTests(SorteoBase):
    AR = "+54 9 11 2345 6789"

    def test_se_registra_y_verifica_con_un_celular_de_otro_pais(self):
        resp = self.activar(celular=self.AR, canal="CELULAR")
        cuenta = CuentaFidelizacion.objects.get()
        self.assertEqual(cuenta.celular, "+5491123456789")
        self.assertIsNotNone(cuenta.celular_verificado_en)
        self.assertRegex(resp.data["tarjeta"]["codigo"], r"^PA-")

    def test_el_destino_se_muestra_enmascarado_con_su_codigo(self):
        r = self.registrar(celular=self.AR, canal="CELULAR")
        self.assertEqual(r.data["destino"], "+54••••••89")

    def test_recupera_su_tarjeta_escribiendo_el_numero_de_otra_forma(self):
        original = self.activar(celular=self.AR, canal="CELULAR")
        self.envejecer("+5491123456789")
        r = self.post("recuperar/", {"contacto": "0054 9 11 2345-6789"})
        ok = self.post("verificar/", {"desafio": r.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(ok.data["tarjeta"]["codigo"], original.data["tarjeta"]["codigo"])

    def test_sin_codigo_de_pais_no_se_acepta_y_el_mensaje_lo_explica(self):
        r = self.registrar(celular="3001234567")
        self.assertEqual(r.status_code, 400)
        self.assertIn("código de tu país", str(r.data["celular"][0]))

    def test_el_mismo_numero_escrito_distinto_es_el_mismo_contacto(self):
        self.activar(celular=self.AR, canal="CELULAR")
        self.envejecer("+5491123456789")
        # otra persona intenta registrarse con ese celular ya verificado: no se duplica la tarjeta
        self.registrar(celular="+5491123456789", canal="CELULAR", correo="otra@ejemplo.com", nombres="Otra")
        self.assertEqual(CuentaFidelizacion.objects.count(), 1)

    def test_bolivia_sigue_igual(self):
        self.activar(celular="+591 712-34567", canal="CELULAR")
        self.assertEqual(CuentaFidelizacion.objects.get().celular, "71234567")
