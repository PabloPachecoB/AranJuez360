from django.core import mail

from sorteo.models import CuentaFidelizacion, DesafioContacto

from .base import CODIGO_FIJO, SorteoBase


class RegistroTests(SorteoBase):
    def test_alta_crea_cuenta_pendiente_y_envia_el_codigo_al_correo(self):
        resp = self.registrar()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["canal"], "CORREO")
        self.assertEqual(resp.data["destino"], "m••••@ejemplo.com")  # enmascarado
        cuenta = CuentaFidelizacion.objects.get()
        self.assertEqual(cuenta.estado, CuentaFidelizacion.Estado.PENDIENTE)
        self.assertIsNone(cuenta.correo_verificado_en)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["maria@ejemplo.com"])
        self.assertIn(CODIGO_FIJO, mail.outbox[0].body)

    def test_no_guarda_el_codigo_en_claro(self):
        self.registrar()
        desafio = DesafioContacto.objects.get()
        self.assertNotEqual(desafio.codigo_hash, CODIGO_FIJO)
        self.assertEqual(len(desafio.codigo_hash), 64)

    def test_normaliza_correo_celular_y_nombres(self):
        self.registrar(correo="  MARIA@Ejemplo.com ", celular="+591 712-34567", nombres="  Ana   Lucía ")
        cuenta = CuentaFidelizacion.objects.get()
        self.assertEqual(cuenta.correo, "maria@ejemplo.com")
        self.assertEqual(cuenta.celular, "71234567")
        self.assertEqual(cuenta.nombres, "Ana Lucía")

    def test_datos_invalidos(self):
        casos = {
            "correo": "no-es-correo",
            "celular": "51234567",  # no empieza con 6 o 7
            "nombres": "A",
            "apellidos": "",
            "canal": "PALOMA",
            "acepta_terminos": False,
        }
        for campo, valor in casos.items():
            with self.subTest(campo=campo):
                resp = self.registrar(**{campo: valor})
                self.assertEqual(resp.status_code, 400, resp.data)
                self.assertIn(campo, resp.data)
        self.assertEqual(CuentaFidelizacion.objects.count(), 0)

    def test_celular_sin_proveedor_no_esta_disponible(self):
        with self.settings(SORTEO_CANAL_CELULAR="ninguno"):
            resp = self.registrar(canal="CELULAR")
            self.assertEqual(resp.status_code, 400)
            self.assertEqual(resp.data["codigo"], "canal_no_disponible")
            self.assertEqual(self.get("campania/").data["canales"], ["CORREO"])
        self.assertEqual(self.get("campania/").data["canales"], ["CORREO", "CELULAR"])
        self.assertEqual(CuentaFidelizacion.objects.count(), 0)

    def test_registro_por_celular(self):
        resp = self.registrar(canal="CELULAR")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["destino"], "••••••67")
        self.assertEqual(len(mail.outbox), 0)  # el celular no manda correo

    def test_repetir_el_registro_reutiliza_la_cuenta_pendiente(self):
        self.registrar()
        self.envejecer("maria@ejemplo.com")
        self.registrar(nombres="María", apellidos="Gómez")
        self.assertEqual(CuentaFidelizacion.objects.count(), 1)
        self.assertEqual(CuentaFidelizacion.objects.get().nombres, "María")

    def test_registrar_dos_veces_seguidas_pide_esperar(self):
        self.registrar()
        resp = self.registrar()
        self.assertEqual(resp.status_code, 429)
        self.assertEqual(resp.data["codigo"], "espera_reenvio")

    def test_si_ya_tiene_tarjeta_con_ese_dato_se_le_dice(self):
        self.activar()
        self.envejecer("maria@ejemplo.com")
        mail.outbox.clear()
        resp = self.registrar(nombres="Otra", apellidos="Persona")
        self.assertEqual((resp.status_code, resp.data["codigo"]), (409, "contacto_registrado"))
        self.assertEqual(resp.data["detail"], "Ya tienes una tarjeta con ese correo. Entra a tu tarjeta.")
        self.assertEqual(CuentaFidelizacion.objects.count(), 1)
        self.assertEqual(CuentaFidelizacion.objects.get().nombres, "María José")  # no se pisó
        self.assertEqual(len(mail.outbox), 0)
        # y puede entrar a la suya
        self.assertEqual(self.post("recuperar/", {"contacto": "maria@ejemplo.com"}).status_code, 200)

    def test_el_aviso_de_tarjeta_existente_vale_solo_para_el_dato_confirmado(self):
        self.activar()  # confirmó el correo; su celular 71234567 quedó sin confirmar
        # otra persona con ese mismo celular puede crear su tarjeta confirmándolo ella
        resp = self.registrar(correo="otra@ejemplo.com", canal="CELULAR", nombres="Otra", apellidos="Persona")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_campania_publica(self):
        datos = self.get("campania/").data
        self.assertEqual(datos["activa"], True)
        self.assertEqual(datos["bs_por_punto"], "200.00")
        self.assertEqual(datos["fecha_sorteo"], "2026-12-20")
        self.campania.estado = self.campania.Estado.PAUSADA
        self.campania.save()
        self.assertEqual(self.get("campania/").data["activa"], False)
        # el registro no exige una campaña activa: la tarjeta se usa antes
        self.assertEqual(self.registrar().status_code, 201)
