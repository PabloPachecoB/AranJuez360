from django.core import mail

from sorteo.models import CuentaFidelizacion, DesafioContacto

from .base import CODIGO_FIJO, SorteoBase


class RecuperacionTests(SorteoBase):
    def test_recuperar_devuelve_la_misma_cuenta_y_el_mismo_codigo_de_tarjeta(self):
        original = self.activar()
        self.envejecer("maria@ejemplo.com")
        mail.outbox.clear()

        # Desde otro navegador: solo conoce su correo.
        r = self.post("recuperar/", {"contacto": "MARIA@ejemplo.com"})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(mail.outbox), 1)
        ok = self.post("verificar/", {"desafio": r.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["tarjeta"]["codigo"], original.data["tarjeta"]["codigo"])
        self.assertEqual(CuentaFidelizacion.objects.count(), 1)
        # la sesión nueva funciona
        self.assertEqual(self.get("mi-tarjeta/", **self.auth(ok.data["sesion"])).status_code, 200)

    def test_recuperar_cierra_las_sesiones_anteriores(self):
        original = self.activar()
        self.envejecer("maria@ejemplo.com")
        r = self.post("recuperar/", {"contacto": "maria@ejemplo.com"})
        self.post("verificar/", {"desafio": r.data["desafio"], "codigo": CODIGO_FIJO})
        vieja = self.get("mi-tarjeta/", **self.auth(original.data["sesion"]))
        self.assertEqual((vieja.status_code, vieja.data["codigo"]), (401, "sesion_invalida"))

    def test_recuperar_por_celular_si_esta_verificado(self):
        original = self.activar(canal="CELULAR")
        self.envejecer("71234567")
        r = self.post("recuperar/", {"contacto": "+591 71234567"})
        self.assertEqual(r.data["canal"], "CELULAR")
        ok = self.post("verificar/", {"desafio": r.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(ok.data["tarjeta"]["codigo"], original.data["tarjeta"]["codigo"])

    def test_con_el_dato_que_no_confirmo_no_entra(self):
        self.activar(canal="CELULAR")  # confirmó el celular; el correo quedó sin confirmar
        mail.outbox.clear()
        r = self.post("recuperar/", {"contacto": "maria@ejemplo.com"})
        self.assertEqual((r.status_code, r.data["codigo"]), (404, "sin_tarjeta"))
        self.assertEqual(r.data["detail"], "Correo inválido.")
        self.assertEqual(len(mail.outbox), 0)

    def test_si_no_hay_tarjeta_con_ese_dato_lo_dice(self):
        self.activar()
        mail.outbox.clear()
        por_correo = self.post("recuperar/", {"contacto": "nadie@ejemplo.com"})
        self.assertEqual((por_correo.status_code, por_correo.data["codigo"]), (404, "sin_tarjeta"))
        self.assertEqual(por_correo.data["detail"], "Correo inválido.")
        por_celular = self.post("recuperar/", {"contacto": "78945631"})
        self.assertEqual((por_celular.status_code, por_celular.data["codigo"]), (404, "sin_tarjeta"))
        self.assertEqual(por_celular.data["detail"], "Celular inválido.")
        # no se envía nada ni se gasta el cupo de códigos de ese contacto
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(DesafioContacto.objects.filter(destino__in=["nadie@ejemplo.com", "78945631"]).count(), 0)

    def test_contacto_mal_escrito_dice_que_le_falta(self):
        casos = {
            "11": "Celular incompleto.",
            "7894563": "Celular incompleto.",
            "aa": "El celular solo lleva números.",
            "51234567": "El celular empieza con 6 o 7.",
            "juan@": "Correo incompleto.",
            "juan@gmail": "Correo incompleto.",
            "@gmail.com": "Correo incompleto.",
            "ju an@gmail.com": "Revisa tu correo.",
        }
        for entrada, mensaje in casos.items():
            with self.subTest(entrada=entrada):
                r = self.post("recuperar/", {"contacto": entrada})
                self.assertEqual((r.status_code, r.data["codigo"]), (400, "contacto_invalido"))
                self.assertEqual(r.data["detail"], mensaje)

    def test_cuenta_bloqueada_lo_dice_y_no_envia_codigo(self):
        self.activar()
        CuentaFidelizacion.objects.update(estado=CuentaFidelizacion.Estado.BLOQUEADA)
        self.envejecer("maria@ejemplo.com")
        mail.outbox.clear()
        r = self.post("recuperar/", {"contacto": "maria@ejemplo.com"})
        self.assertEqual((r.status_code, r.data["codigo"]), (403, "cuenta_bloqueada"))
        self.assertEqual(len(mail.outbox), 0)
