from django.db import IntegrityError, transaction

from sorteo import services
from sorteo.codigos import ALFABETO_TARJETA, nuevo_codigo_tarjeta, normalizar_codigo_tarjeta
from sorteo.models import CodigoTarjeta, CuentaFidelizacion
from usuarios.models import Usuario

from .base import SorteoBase


class CodigoTarjetaTests(SorteoBase):
    def test_formato_y_alfabeto(self):
        for _ in range(200):
            codigo = nuevo_codigo_tarjeta()
            self.assertRegex(codigo, r"^PA-[A-Z2-9]{6}$")
            self.assertFalse(set(codigo[3:]) & set("01OIL"))
        self.assertEqual(len(set(ALFABETO_TARJETA)), len(ALFABETO_TARJETA))

    def test_normaliza_minusculas_y_rechaza_formas_raras(self):
        self.assertEqual(normalizar_codigo_tarjeta(" pa-7k3m9x "), "PA-7K3M9X")
        for malo in ("", "PA-123", "PA-7K3M9X1", "XX-7K3M9X", "PA-0K3M9X", "../etc"):
            with self.subTest(malo=malo):
                self.assertIsNone(normalizar_codigo_tarjeta(malo))

    def test_el_codigo_no_contiene_datos_de_la_persona(self):
        resp = self.activar()
        codigo = resp.data["tarjeta"]["codigo"].lower()
        for dato in ("maria", "gomez", "ejemplo", "712"):
            self.assertNotIn(dato, codigo)

    def test_un_solo_codigo_activo_por_cuenta(self):
        self.activar()
        cuenta = CuentaFidelizacion.objects.get()
        with self.assertRaises(IntegrityError), transaction.atomic():
            CodigoTarjeta.objects.create(cuenta=cuenta, codigo="PA-AAAAAA")

    def test_revocar_emite_otro_y_el_viejo_deja_de_resolver(self):
        resp = self.activar()
        viejo = resp.data["tarjeta"]["codigo"]
        cuenta = CuentaFidelizacion.objects.get()
        admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)

        nuevo = services.revocar_codigo(cuenta.pk, admin, "Cliente perdió el celular")
        self.assertNotEqual(nuevo.codigo, viejo)
        self.assertEqual(services.resolver_codigo(nuevo.codigo).pk, cuenta.pk)
        with self.assertRaises(Exception) as ctx:
            services.resolver_codigo(viejo)
        self.assertEqual(ctx.exception.codigo, "qr_invalido")

        anterior = CodigoTarjeta.objects.get(codigo=viejo)
        self.assertFalse(anterior.activo)
        self.assertEqual(anterior.revocado_por, admin)
        self.assertEqual(cuenta.codigos.filter(activo=True).count(), 1)
        # la tarjeta de la persona muestra el código nuevo
        sesion = resp.data["sesion"]
        self.assertEqual(self.get("mi-tarjeta/", **self.auth(sesion)).data["codigo"], nuevo.codigo)
