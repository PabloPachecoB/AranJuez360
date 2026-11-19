"""Montos verificados: Jarvis no inventa precios y los cobros salen siempre del backend."""

from decimal import Decimal
from unittest import mock

from rest_framework.test import APITestCase

from empresas.models import Empresa, Producto
from fidelizacion.models import Recompensa
from usuarios.models import Usuario

from .testing import FakeLLM


class MontosVerificadosTests(APITestCase):
    """Jarvis no puede inventar montos ni pedir "Confirmar" sin propuesta; los cobros no dependen de lo que diga."""

    def setUp(self):
        from empresas.models import Categoria

        comida = Categoria.objects.create(nombre="Comida")
        self.hoyhay = Empresa.objects.create(nombre="HOY HAY", piso="3", email_contacto="h@h.bo", categoria=comida)
        self.latte = Producto.objects.create(empresa=self.hoyhay, nombre="Latte de vainilla", precio=Decimal("20"))
        self.americano = Producto.objects.create(empresa=self.hoyhay, nombre="Café americano", precio=Decimal("14"))
        self.cliente = Usuario.objects.create_user("m", password="x", rol=Usuario.Rol.CLIENTE, puntos_saldo=416)
        Recompensa.objects.create(nombre="Capuchino gratis", costo_puntos=500)

    def _prompt(self):
        from .contexto import construir_contexto, prompt_sistema

        return prompt_sistema(construir_contexto(self.cliente))

    def test_montos_de_los_datos_y_sus_sumas_pasan(self):
        from .agent.guardrails import montos_sin_respaldo

        prompt = self._prompt()
        for texto in ("El latte de vainilla cuesta 20 bolivianos.", "Cinco lattes son 100 bolivianos.",
                      "Un latte y un americano son 34 bolivianos.", "Tienes 416 monedas.",
                      "Te faltan 84 monedas para el capuchino gratis."):
            self.assertEqual(montos_sin_respaldo(texto, prompt), [], texto)

    def test_montos_inventados_o_en_letras_se_detectan(self):
        from .agent.guardrails import montos_sin_respaldo

        prompt = self._prompt()
        self.assertEqual(montos_sin_respaldo("Cinco lattes son 110 bolivianos.", prompt), ["110 bolivianos"])
        self.assertTrue(montos_sin_respaldo("El latte cuesta veinte bolivianos.", prompt))
        self.assertEqual(montos_sin_respaldo("Tienes 999 monedas.", prompt), ["999 monedas"])

    def test_respuesta_con_monto_inventado_se_corrige_o_se_omite(self):
        from .agent.graph import _verificar_montos

        llm = FakeLLM()
        llm.chat = lambda system, messages: "Cinco lattes siguen siendo 110 bolivianos."  # insiste
        with mock.patch("agente.agent.graph.get_llm_adapter", return_value=llm):
            texto = _verificar_montos(self._prompt(), {"messages": []}, "Cinco lattes son 110 bolivianos.")
        self.assertNotIn("110", texto)
        self.assertIn("no darte un monto", texto)

        llm.chat = lambda system, messages: "Cinco lattes son 100 bolivianos."  # corrige
        with mock.patch("agente.agent.graph.get_llm_adapter", return_value=llm):
            texto = _verificar_montos(self._prompt(), {"messages": []}, "Cinco lattes son 110 bolivianos.")
        self.assertEqual(texto, "Cinco lattes son 100 bolivianos.")

    def test_sin_propuesta_no_pide_tocar_confirmar(self):
        """Lo que pasó el 19/10: tras el pedido, Jarvis "corrigió" y volvió a pedir Confirmar sin botón."""
        from .agent.graph import _verificar_montos

        texto = _verificar_montos(
            self._prompt(), {"messages": []},
            "Cinco lattes son 100 bolivianos. Toca Confirmar para dejarlo listo.",
        )
        self.assertEqual(texto, "Cinco lattes son 100 bolivianos.")

    def test_si_cambia_el_precio_antes_de_confirmar_no_se_crea_el_pedido(self):
        from fidelizacion.services import ReglaNegocioError
        from pedidos.models import Pedido

        from . import herramientas

        resumen, payload = herramientas.preparar(
            "pedir_comida", self.cliente, {"items": [{"producto_id": self.latte.id, "cantidad": 5}]})
        self.assertIn("Bs 100", resumen)
        Producto.objects.filter(pk=self.latte.pk).update(precio=Decimal("22"))  # el negocio lo cambia
        with self.assertRaisesRegex(ReglaNegocioError, "precio cambió"):
            herramientas.ejecutar("pedir_comida", self.cliente, payload)
        self.assertFalse(Pedido.objects.exists())

    def test_el_qr_cobra_lo_propuesto_por_el_backend(self):
        from pedidos.models import Pedido

        from . import herramientas

        resumen, payload = herramientas.preparar(
            "pedir_comida", self.cliente, {"items": [{"producto_id": self.latte.id, "cantidad": 5}]})
        _, resultado = herramientas.ejecutar("pedir_comida", self.cliente, payload)
        self.assertEqual(Pedido.objects.get(pk=resultado["id"]).total, Decimal("100"))

    def test_canje_y_cine_tambien_respetan_el_monto_propuesto(self):
        from datetime import timedelta

        from django.utils import timezone

        from entretenimiento.models import Funcion, Pelicula
        from fidelizacion.services import ReglaNegocioError

        from . import herramientas

        Usuario.objects.filter(pk=self.cliente.pk).update(puntos_saldo=5000)
        recompensa = Recompensa.objects.create(nombre="Parqueo", costo_puntos=50, categoria="PARQUEO")
        _, payload = herramientas.preparar("canjear_recompensa", self.cliente, {"recompensa_id": recompensa.id})
        Recompensa.objects.filter(pk=recompensa.pk).update(costo_puntos=80)
        with self.assertRaisesRegex(ReglaNegocioError, "costo en monedas cambió"):
            herramientas.ejecutar("canjear_recompensa", self.cliente, payload)

        funcion = Funcion.objects.create(pelicula=Pelicula.objects.create(titulo="Galaxia"),
                                         inicio=timezone.now() + timedelta(hours=5), precio=35)
        _, payload = herramientas.preparar("reservar_entradas_cine", self.cliente,
                                           {"funcion_id": funcion.id, "cantidad": 2, "metodo": "BOLETERIA"})
        Funcion.objects.filter(pk=funcion.pk).update(precio=40)
        with self.assertRaisesRegex(ReglaNegocioError, "precio de las entradas"):
            herramientas.ejecutar("reservar_entradas_cine", self.cliente, payload)

    def test_propuesta_de_pedido_no_dice_el_total_y_la_tarjeta_trae_el_detalle(self):
        from .agent.graph import _proponer_accion

        texto, accion = _proponer_accion({"user_id": self.cliente.id, "thread_id": "t"}, "pedir_comida",
                                         {"items": [{"producto_id": self.latte.id, "cantidad": 5},
                                                    {"producto_id": self.americano.id, "cantidad": 1}]})
        self.assertNotRegex(texto, r"\d")  # la voz no lee montos
        detalle = accion["detalle"]
        self.assertEqual(detalle["lineas"][0], {"nombre": "Latte de vainilla", "cantidad": 5,
                                                "precio": "20.00", "subtotal": "100.00"})
        self.assertEqual(detalle["total"], "114.00")
        self.assertEqual(detalle["local"], "HOY HAY (piso 3)")

    def test_al_confirmar_el_pedido_entrega_el_qr_sin_repetir_el_total(self):
        from . import herramientas

        _, payload = herramientas.preparar(
            "pedir_comida", self.cliente, {"items": [{"producto_id": self.latte.id, "cantidad": 5}]})
        texto, resultado = herramientas.ejecutar("pedir_comida", self.cliente, payload)
        self.assertIn("Aquí está tu QR", texto)
        self.assertNotIn("100", texto)
        self.assertEqual(resultado["tipo"], "pedido")
