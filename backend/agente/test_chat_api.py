from decimal import Decimal
from unittest import mock

from rest_framework.test import APITestCase

from empresas.models import Empresa, Producto

from .llm import LLMError
from .models import ConversacionJarvis, MensajeJarvis
from .testing import AgentApiTestMixin


class ChatApiTests(AgentApiTestMixin, APITestCase):
    def test_chat_usa_contexto_real_del_usuario(self):
        resp = self._chat("hola")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["text"], "Respuesta a: hola")
        system, _ = self.llm.llamadas[-1]
        self.assertIn("Ana", system)
        self.assertIn("420 monedas", system)
        self.assertIn("Café gratis (otro): 300 monedas", system)

    def test_recomienda_platos_y_devuelve_fichas_de_los_locales_nombrados(self):
        pastas = Empresa.objects.create(nombre="Solo Pastas", piso="3", email_contacto="p@p.com")
        Producto.objects.create(empresa=pastas, nombre="Lasaña de carne", precio=Decimal("55"))
        Empresa.objects.create(nombre="Tigo", email_contacto="t@t.com")
        resp = self._chat("estoy triste contigo, ¿qué tal solo pastas?")
        system, _ = self.llm.llamadas[-1]
        self.assertIn("Menú: Lasaña de carne Bs 55.", system)
        self.assertEqual([empresa["nombre"] for empresa in resp.data["empresas"]], ["Solo Pastas"])
        self.assertEqual(resp.data["empresas"][0]["piso"], "3")

    def test_emociones_van_a_la_voz_y_no_a_la_pantalla(self):
        with mock.patch.object(self.llm, "chat", return_value="[excited] ¡Felicidades! [warmly] Te alcanza un café."):
            resp = self._chat("tengo puntos?")
        self.assertEqual(resp.data["text"], "¡Felicidades! Te alcanza un café.")
        self.assertEqual(resp.data["voz"], "[excited] ¡Felicidades! [warmly] Te alcanza un café.")

    def test_chat_recuerda_el_hilo(self):
        self._chat("hola")
        self._chat("y mis puntos?")
        _, messages = self.llm.llamadas[-1]
        self.assertEqual([mensaje["role"] for mensaje in messages], ["user", "assistant", "user"])

    def test_chat_persiste_turnos_y_no_expone_thread_id_del_cliente(self):
        respuesta = self._chat("hola")
        mensajes = list(
            MensajeJarvis.objects.filter(conversacion_id=respuesta.data["conversation_id"])
            .order_by("creado_en", "id")
        )
        self.assertEqual(
            [(mensaje.rol, mensaje.contenido) for mensaje in mensajes],
            [
                (MensajeJarvis.Rol.USUARIO, "hola"),
                (MensajeJarvis.Rol.ASISTENTE, "Respuesta a: hola"),
            ],
        )

    def test_historial_persiste_tarjetas_de_respuesta_de_texto(self):
        empresa, producto = self._crear_tarjetas_demo()
        texto = f"Te recomiendo {producto.nombre} de {empresa.nombre}."
        with mock.patch.object(
            self.servicio._graph,
            "invoke",
            return_value={"presentation": {"text": texto, "voz": texto, "accion": None}},
        ):
            respuesta = self._chat("recomiendame un café")

        historial = self.client.get(
            f"/api/v1/agente/conversaciones/{respuesta.data['conversation_id']}/mensajes/"
        )
        mensaje = historial.data[-1]
        self.assertEqual(mensaje["productos"], respuesta.data["productos"])
        self.assertEqual(mensaje["empresas"], respuesta.data["empresas"])
        self.assertNotIn("metadatos", mensaje)

    def test_chat_usa_thread_interno_opaco(self):
        respuesta_grafo = {
            "presentation": {"text": "Respuesta segura", "voz": "Respuesta segura", "accion": None},
            "guardrail_triggered": False,
        }
        with mock.patch.object(self.servicio._graph, "invoke", return_value=respuesta_grafo) as invoke:
            respuesta = self._chat("hola")

        conversacion = ConversacionJarvis.objects.get(pk=respuesta.data["conversation_id"])
        thread_usado = invoke.call_args.kwargs["config"]["configurable"]["thread_id"]
        self.assertEqual(thread_usado, str(conversacion.thread_id))
        self.assertNotEqual(thread_usado, str(conversacion.id))
        self.assertNotIn("thread_id", respuesta.data)

    def test_chat_rechaza_thread_id_del_cliente(self):
        respuesta = self.client.post(
            "/api/v1/agente/acciones/chat/",
            {"message": "hola", "thread_id": "cliente-no-controla-esto"},
            format="json",
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("thread_id", respuesta.data)

    def test_chat_responde_aunque_falle_el_llm(self):
        with mock.patch.object(self.llm, "chat", side_effect=LLMError("cuota agotada")):
            resp = self._chat("hola")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("no puedo responder", resp.data["text"])
        self.assertEqual(
            MensajeJarvis.objects.filter(conversacion_id=resp.data["conversation_id"])
            .order_by("-creado_en", "-id")
            .first()
            .contenido,
            resp.data["text"],
        )

    def test_requiere_autenticacion(self):
        self.client.force_authenticate(None)
        self.assertEqual(self._chat("hola").status_code, 401)


class ChatMuestraPlatosYReintentaTests(APITestCase):
    def setUp(self):
        from empresas.models import Categoria
        from usuarios.models import Usuario

        comida = Categoria.objects.create(nombre="Comida")
        cafe = Empresa.objects.create(nombre="Café Aranjuez", email_contacto="c@x.bo", categoria=comida, piso="1")
        hoyhay = Empresa.objects.create(nombre="HOY HAY", email_contacto="h@x.bo", categoria=comida, piso="3")
        self.cap_cafe = Producto.objects.create(empresa=cafe, nombre="Capuchino", precio=Decimal("22"))
        self.cap_hoyhay = Producto.objects.create(empresa=hoyhay, nombre="Capuchino", precio=Decimal("14"))
        self.cliente = Usuario.objects.create_user("c", password="x", rol=Usuario.Rol.CLIENTE)

    def test_solo_trae_el_plato_del_local_que_nombra(self):
        from rest_framework.test import APIRequestFactory

        from .api import _productos_mencionados

        peticion = APIRequestFactory().get("/")
        fichas = _productos_mencionados(peticion, "Te sugiero el Capuchino de HOY HAY, piso 3.")
        self.assertEqual([(ficha["empresa_nombre"], ficha["precio"]) for ficha in fichas], [("HOY HAY", "14.00")])
        self.assertEqual(_productos_mencionados(peticion, "El capuchino está rico."), [])

    def test_promesa_sin_herramienta_se_reintenta_y_nunca_queda_sin_boton(self):
        from .agent import graph

        proponer = mock.MagicMock(return_value=("[warmly] Te lo dejo listo: X", {"id": 1, "tipo": "pedir_comida", "resumen": "X"}))
        adaptador = mock.MagicMock()
        adaptador.chat_con_herramientas.side_effect = [
            ("Te dejo el pedido del Capuchino de HOY HAY para retirar hoy.", []),
            ("", [("pedir_comida", {"items": [{"producto_id": self.cap_hoyhay.id, "cantidad": 1}]})]),
        ]
        estado = {"user_id": self.cliente.id, "thread_id": "t", "messages": [], "authenticated_context": {}}
        with mock.patch.object(graph, "get_llm_adapter", return_value=adaptador), mock.patch.object(graph, "_proponer_accion", proponer):
            resultado = graph._presentar(estado)
        self.assertEqual(adaptador.chat_con_herramientas.call_count, 2)
        self.assertIsNotNone(resultado["presentation"]["accion"])

        adaptador.chat_con_herramientas.side_effect = [("Te dejo el pedido listo.", []), ("Listo, te lo pido.", [])]
        with mock.patch.object(graph, "get_llm_adapter", return_value=adaptador):
            resultado = graph._presentar(estado)
        self.assertIsNone(resultado["presentation"]["accion"])
        self.assertIn("No logré dejar la solicitud lista", resultado["presentation"]["text"])
