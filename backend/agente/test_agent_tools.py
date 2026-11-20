from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.utils import timezone
from rest_framework.test import APITestCase

from empresas.models import Categoria, Empresa, Producto
from entretenimiento.models import Evento
from usuarios.models import Usuario


class PedidosYEventosJarvisTests(APITestCase):
    """Herramientas: pedir comida y reservar cupos en eventos."""

    def setUp(self):
        comida = Categoria.objects.create(nombre="Comida")
        self.burger = Empresa.objects.create(
            nombre="Burger Paseo", email_contacto="b@x.bo", categoria=comida, piso="1"
        )
        self.hamburguesa = Producto.objects.create(
            empresa=self.burger, nombre="Hamburguesa clásica", precio=Decimal("39")
        )
        tecno = Empresa.objects.create(nombre="TecnoPlus", email_contacto="t@x.bo")
        self.audifonos = Producto.objects.create(
            empresa=tecno, nombre="Audífonos", precio=Decimal("250")
        )
        self.cliente = Usuario.objects.create_user("c", password="x", rol=Usuario.Rol.CLIENTE)
        inicio = timezone.now() + timedelta(days=1)
        self.concierto = Evento.objects.create(titulo="Acústico", inicio=inicio, cupos=2)
        self.feria = Evento.objects.create(titulo="Feria", inicio=inicio, precio=Decimal("15"))

    def test_pide_comida_y_crea_pedido_por_pagar(self):
        from pedidos.models import Pedido

        from . import herramientas

        resumen, payload = herramientas.preparar(
            "pedir_comida", self.cliente, {"items": [{"producto_id": self.hamburguesa.id, "cantidad": 2}]}
        )
        self.assertIn("2 Hamburguesa clásica en Burger Paseo", resumen)
        self.assertIn("Bs 78", resumen)
        texto, resultado = herramientas.ejecutar("pedir_comida", self.cliente, payload)
        pedido = Pedido.objects.get(pk=resultado["id"])
        self.assertEqual((resultado["tipo"], pedido.estado), ("pedido", "PENDIENTE_PAGO"))

    def test_no_compra_lo_que_no_es_comida(self):
        from fidelizacion.services import ReglaNegocioError

        from . import herramientas

        with self.assertRaisesRegex(ReglaNegocioError, "solo puedo pedir comida"):
            herramientas.preparar("pedir_comida", self.cliente, {"items": [{"producto_id": self.audifonos.id}]})

    def test_reserva_cupos_y_rechaza_eventos_libres(self):
        from fidelizacion.services import ReglaNegocioError

        from . import herramientas

        resumen, payload = herramientas.preparar(
            "reservar_cupo_evento", self.cliente, {"evento_id": self.concierto.id, "cantidad": 2}
        )
        texto, resultado = herramientas.ejecutar("reservar_cupo_evento", self.cliente, payload)
        self.assertEqual(resultado["tipo"], "entrada")
        self.assertTrue(resultado["qr"].startswith("paseo360://evento/"))
        with self.assertRaisesRegex(ReglaNegocioError, "acceso libre"):
            herramientas.preparar("reservar_cupo_evento", self.cliente, {"evento_id": self.feria.id, "cantidad": 1})

    def test_contexto_trae_ids_de_platos_y_eventos(self):
        from .contexto import construir_contexto, prompt_sistema

        prompt = prompt_sistema(construir_contexto(self.cliente))
        self.assertIn(f"[{self.hamburguesa.id}] Hamburguesa clásica", prompt)
        self.assertIn(f"[{self.concierto.id}] Acústico", prompt)
        self.assertNotIn(f"[{self.audifonos.id}] Audífonos", prompt)


class PreciosEnBolivianosTests(APITestCase):
    def test_bs_se_lee_como_bolivianos(self):
        from .voz import en_bolivianos

        self.assertEqual(
            en_bolivianos("Cuesta Bs 52 y el combo Bs. 39,50."),
            "Cuesta 52 bolivianos y el combo 39,50 bolivianos.",
        )
        self.assertEqual(en_bolivianos("Solo Bs1."), "Solo 1 boliviano.")
        self.assertEqual(en_bolivianos("Absoluto 5 bolivianos"), "Absoluto 5 bolivianos")
