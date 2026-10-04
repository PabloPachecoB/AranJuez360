from decimal import Decimal
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from empresas.models import Empresa, Producto
from fidelizacion.models import Recompensa
from usuarios.models import Usuario

from .agent.checkpoints import CheckpointSettings, build_checkpoint_runtime
from .agent.service import AgentConversationService
from .llm import LLMError
from .voz import VozError


class FakeLLM:
    """Sustituye al proveedor real: no gasta cuota ni necesita red."""

    soporta_audio = True

    def __init__(self):
        self.llamadas = []

    herramienta = None  # (nombre, argumentos) que "pide" el modelo en el próximo turno

    def chat(self, system, messages):
        self.llamadas.append((system, messages))
        return f"Respuesta a: {messages[-1]['content']}"

    def chat_con_herramientas(self, system, messages, tools):
        if self.herramienta:
            return "", [self.herramienta]
        return self.chat(system, messages), []

    def transcribe(self, audio, formato):
        return "cuántos puntos tengo"


class AsistenteTests(APITestCase):
    def setUp(self):
        self.cliente = Usuario.objects.create_user(
            "cli", password="x", first_name="Ana", rol=Usuario.Rol.CLIENTE, puntos_saldo=420
        )
        Recompensa.objects.create(nombre="Café gratis", costo_puntos=300)
        self.llm = FakeLLM()
        memoria = build_checkpoint_runtime(CheckpointSettings(backend="memory", sqlite_path=""))
        with mock.patch("agente.agent.service.get_checkpoint_runtime", return_value=memoria):
            servicio = AgentConversationService()
        for objetivo, valor in (
            ("agente.api.get_conversation_service", lambda: servicio),
            ("agente.api.get_llm_adapter", lambda: self.llm),
            ("agente.agent.graph.get_llm_adapter", lambda: self.llm),
        ):
            patcher = mock.patch(objetivo, valor)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.client.force_authenticate(self.cliente)

    def _chat(self, mensaje):
        return self.client.post(
            "/api/v1/agente/acciones/chat/", {"message": mensaje, "thread_id": "t1"}, format="json"
        )

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
        # "contigo" no debe traer la ficha de Tigo.
        self.assertEqual([e["nombre"] for e in resp.data["empresas"]], ["Solo Pastas"])
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
        self.assertEqual(
            [m["role"] for m in messages], ["user", "assistant", "user"]
        )

    def test_chat_responde_aunque_falle_el_llm(self):
        with mock.patch.object(self.llm, "chat", side_effect=LLMError("cuota agotada")):
            resp = self._chat("hola")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("no puedo responder", resp.data["text"])

    def test_voz_transcribe_y_responde(self):
        audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
        resp = self.client.post(
            "/api/v1/agente/acciones/voz/", {"audio": audio, "thread_id": "t1"}, format="multipart"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["transcripcion"], "cuántos puntos tengo")
        self.assertEqual(resp.data["text"], "Respuesta a: cuántos puntos tengo")

    def test_voz_rechaza_formato_desconocido(self):
        archivo = SimpleUploadedFile("virus.exe", b"x")
        resp = self.client.post("/api/v1/agente/acciones/voz/", {"audio": archivo}, format="multipart")
        self.assertEqual(resp.status_code, 400)

    def test_voz_sin_modelo_de_audio(self):
        audio = SimpleUploadedFile("nota.m4a", b"x")
        with mock.patch.object(self.llm, "transcribe", side_effect=LLMError("sin modelo")):
            resp = self.client.post("/api/v1/agente/acciones/voz/", {"audio": audio}, format="multipart")
        self.assertEqual(resp.status_code, 503)

    def test_hablar_devuelve_mp3(self):
        with mock.patch("agente.api.sintetizar", return_value=b"ID3-mp3") as sintetizar:
            resp = self.client.get("/api/v1/agente/acciones/hablar/", {"texto": "Hola Ana"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "audio/mpeg")
        self.assertEqual(resp.content, b"ID3-mp3")
        sintetizar.assert_called_once_with("Hola Ana")

    def test_sin_elevenlabs_usa_edge_sin_etiquetas(self):
        from django.core.cache import cache

        from . import voz

        cache.clear()  # el audio se cachea por texto: sin esto podría venir de otra prueba

        with mock.patch.dict("os.environ", {"ELEVENLABS_API_KEY": ""}),                 mock.patch.object(voz, "_edge", return_value=b"mp3") as edge:
            self.assertEqual(voz.sintetizar("[warmly] Hola prueba-edge"), b"mp3")
        edge.assert_called_once()

    def test_si_falla_elevenlabs_respalda_con_edge(self):
        from . import voz

        with mock.patch.dict("os.environ", {"ELEVENLABS_API_KEY": "x"}),                 mock.patch.object(voz, "_elevenlabs", side_effect=voz.VozError("sin créditos")),                 mock.patch.object(voz, "_edge", return_value=b"mp3-edge"):
            self.assertEqual(voz.sintetizar("Hola prueba-respaldo"), b"mp3-edge")
        self.assertEqual(voz.quitar_emociones("[sighs] Lo siento.  [warmly] Ya cerró."), "Lo siento. Ya cerró.")

    def test_hablar_valida_texto_y_falla_con_gracia(self):
        self.assertEqual(self.client.get("/api/v1/agente/acciones/hablar/").status_code, 400)
        with mock.patch("agente.api.sintetizar", side_effect=VozError("sin red")):
            resp = self.client.get("/api/v1/agente/acciones/hablar/", {"texto": "hola"})
        self.assertEqual(resp.status_code, 503)

    def test_requiere_autenticacion(self):
        self.client.force_authenticate(None)
        self.assertEqual(self._chat("hola").status_code, 401)



class AccionesJarvisTests(AsistenteTests):
    # Reutiliza setUp (LLM falso, memoria) sin volver a correr las pruebas del asistente.
    test_chat_usa_contexto_real_del_usuario = test_chat_recuerda_el_hilo = None
    test_chat_responde_aunque_falle_el_llm = test_emociones_van_a_la_voz_y_no_a_la_pantalla = None
    test_voz_transcribe_y_responde = test_voz_rechaza_formato_desconocido = test_voz_sin_modelo_de_audio = None
    test_hablar_devuelve_mp3 = test_hablar_valida_texto_y_falla_con_gracia = None
    test_sin_elevenlabs_usa_edge_sin_etiquetas = test_si_falla_elevenlabs_respalda_con_edge = None
    test_requiere_autenticacion = None

    """Jarvis propone acciones y solo se ejecutan al confirmar."""

    def setUp(self):
        super().setUp()
        from datetime import timedelta

        from django.utils import timezone
        from entretenimiento.models import Funcion, Pelicula

        Usuario.objects.filter(pk=self.cliente.pk).update(puntos_saldo=5000)
        self.parqueo = Recompensa.objects.create(nombre="Parqueo", costo_puntos=50, categoria="PARQUEO")
        peli = Pelicula.objects.create(titulo="Galaxia")
        self.funcion = Funcion.objects.create(pelicula=peli, inicio=timezone.now() + timedelta(hours=5), precio=35)

    def _saldo(self):
        self.cliente.refresh_from_db()
        return self.cliente.puntos_saldo

    def _confirmar(self, accion_id):
        return self.client.post(f"/api/v1/agente/acciones/{accion_id}/confirmar/", {}, format="json")

    def test_canje_propuesto_no_cobra_hasta_confirmar(self):
        self.llm.herramienta = ("canjear_recompensa", {"recompensa_id": self.parqueo.id})
        resp = self._chat("canjéame el parqueo")
        self.assertEqual(resp.status_code, 200)
        accion = resp.data["accion"]
        self.assertIn("Parqueo", accion["resumen"])
        self.assertIn("Confirmar", resp.data["text"])
        self.assertEqual(self._saldo(), 5000)  # todavía no cobró

        ok = self._confirmar(accion["id"])
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["resultado"]["tipo"], "canje")
        self.assertEqual(self._saldo(), 4950)
        self.assertEqual(self._confirmar(accion["id"]).status_code, 400)  # no se ejecuta dos veces

    def test_reserva_con_monedas_y_cancelacion(self):
        from entretenimiento.models import ReservaCine

        self.llm.herramienta = ("reservar_entradas_cine",
                                {"funcion_id": self.funcion.id, "cantidad": 2, "metodo": "MONEDAS"})
        accion = self._chat("dos entradas").data["accion"]
        self.assertIn("2333,34 monedas", accion["resumen"])  # 2 × Bs 35 / Bs 0,03 (redondeo hacia arriba)
        self.assertEqual(self._confirmar(accion["id"]).status_code, 200)
        self.assertEqual(self._saldo(), Decimal("2666.66"))
        reserva = ReservaCine.objects.get()

        self.llm.herramienta = ("cancelar_reserva_cine", {"reserva_id": reserva.id})
        accion = self._chat("cancela").data["accion"]
        self.assertEqual(self._confirmar(accion["id"]).status_code, 200)
        self.assertEqual(self._saldo(), 5000)  # devolvió las monedas

    def test_accion_invalida_responde_sin_proponer(self):
        self.llm.herramienta = ("canjear_recompensa", {"recompensa_id": 99999})
        resp = self._chat("canjea algo")
        self.assertIsNone(resp.data["accion"])
        self.assertIn("no existe", resp.data["text"])

    def test_no_se_confirma_accion_de_otro_usuario(self):
        self.llm.herramienta = ("canjear_recompensa", {"recompensa_id": self.parqueo.id})
        accion = self._chat("canjea").data["accion"]
        otro = Usuario.objects.create_user("otro", password="x", rol=Usuario.Rol.CLIENTE)
        self.client.force_authenticate(otro)
        self.assertEqual(self._confirmar(accion["id"]).status_code, 404)


class PedidosYEventosJarvisTests(APITestCase):
    """Herramientas nuevas: pedir comida (pago QR, retiro en el local) y reservar cupos en eventos."""

    def setUp(self):
        from datetime import timedelta

        from django.utils import timezone

        from empresas.models import Categoria
        from entretenimiento.models import Evento

        comida = Categoria.objects.create(nombre="Comida")
        self.burger = Empresa.objects.create(nombre="Burger Paseo", email_contacto="b@x.bo", categoria=comida, piso="1")
        self.hamburguesa = Producto.objects.create(empresa=self.burger, nombre="Hamburguesa clásica", precio=Decimal("39"))
        tecno = Empresa.objects.create(nombre="TecnoPlus", email_contacto="t@x.bo")
        self.audifonos = Producto.objects.create(empresa=tecno, nombre="Audífonos", precio=Decimal("250"))
        self.cliente = Usuario.objects.create_user("c", password="x", rol=Usuario.Rol.CLIENTE)
        inicio = timezone.now() + timedelta(days=1)
        self.concierto = Evento.objects.create(titulo="Acústico", inicio=inicio, cupos=2)
        self.feria = Evento.objects.create(titulo="Feria", inicio=inicio, precio=Decimal("15"))

    def test_pide_comida_y_crea_pedido_por_pagar(self):
        from pedidos.models import Pedido

        from . import herramientas

        resumen, payload = herramientas.preparar(
            "pedir_comida", self.cliente, {"items": [{"producto_id": self.hamburguesa.id, "cantidad": 2}]})
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

        resumen, payload = herramientas.preparar("reservar_cupo_evento", self.cliente,
                                                 {"evento_id": self.concierto.id, "cantidad": 2})
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
        self.assertNotIn(f"[{self.audifonos.id}] Audífonos", prompt)  # lo que no es comida no se pide


class PreciosEnBolivianosTests(APITestCase):
    def test_bs_se_lee_como_bolivianos(self):
        from .voz import en_bolivianos

        self.assertEqual(en_bolivianos("Cuesta Bs 52 y el combo Bs. 39,50."), "Cuesta 52 bolivianos y el combo 39,50 bolivianos.")
        self.assertEqual(en_bolivianos("Solo Bs1."), "Solo 1 boliviano.")
        self.assertEqual(en_bolivianos("Absoluto 5 bolivianos"), "Absoluto 5 bolivianos")  # no toca palabras con "bs"


class ChatMuestraPlatosYReintentaTests(APITestCase):
    def setUp(self):
        from empresas.models import Categoria

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
        self.assertEqual([(f["empresa_nombre"], f["precio"]) for f in fichas], [("HOY HAY", "14.00")])
        self.assertEqual(_productos_mencionados(peticion, "El capuchino está rico."), [])  # sin local, no adivina

    def test_promesa_sin_herramienta_se_reintenta_y_nunca_queda_sin_boton(self):
        from . import herramientas
        from .agent import graph

        proponer = mock.MagicMock(return_value=("[warmly] Te lo dejo listo: X", {"id": 1, "tipo": "pedir_comida", "resumen": "X"}))
        respuestas = [
            ("Te dejo el pedido del Capuchino de HOY HAY para retirar hoy.", []),
            ("", [("pedir_comida", {"items": [{"producto_id": self.cap_hoyhay.id, "cantidad": 1}]})]),
        ]
        adaptador = mock.MagicMock()
        adaptador.chat_con_herramientas.side_effect = respuestas
        estado = {"user_id": self.cliente.id, "thread_id": "t", "messages": [], "authenticated_context": {}}
        with mock.patch.object(graph, "get_llm_adapter", return_value=adaptador), \
                mock.patch.object(graph, "_proponer_accion", proponer):
            resultado = graph._presentar(estado)
        self.assertEqual(adaptador.chat_con_herramientas.call_count, 2)
        self.assertIsNotNone(resultado["presentation"]["accion"])

        # Si ni así llama a la herramienta, nunca dice que lo dejó listo.
        adaptador.chat_con_herramientas.side_effect = [("Te dejo el pedido listo.", []), ("Listo, te lo pido.", [])]
        with mock.patch.object(graph, "get_llm_adapter", return_value=adaptador):
            resultado = graph._presentar(estado)
        self.assertIsNone(resultado["presentation"]["accion"])
        self.assertIn("No logré dejar la solicitud lista", resultado["presentation"]["text"])


class AnalisisAdminTests(APITestCase):
    """El asistente de análisis es solo para admin y consulta datos reales."""

    def setUp(self):
        from rest_framework.test import APIClient
        from usuarios.models import Usuario
        self.api = APIClient()
        self.admin = Usuario.objects.create_user("adm", password="x", rol=Usuario.Rol.ADMIN)
        self.cliente = Usuario.objects.create_user("cli", password="x", rol=Usuario.Rol.CLIENTE)

    def test_solo_admin(self):
        self.assertEqual(self.api.post("/api/v1/agente/admin/analisis/chat/", {"mensaje": "hola"}).status_code, 401)
        self.api.force_authenticate(self.cliente)
        self.assertEqual(self.api.post("/api/v1/agente/admin/analisis/chat/", {"mensaje": "hola"}).status_code, 403)

    def test_todos_los_temas_responden(self):
        from agente import analisis
        for tema in analisis.TEMAS:
            analisis.ejecutar_consulta(tema, 30, 5)
        with self.assertRaises(ValueError):
            analisis.ejecutar_consulta("inexistente")

    def test_chat_usa_herramienta_y_responde(self):
        from types import SimpleNamespace as NS
        from unittest import mock
        llamada = NS(id="t1", function=NS(name="consultar_datos", arguments='{"tema": "resumen", "dias": 7}'))
        respuestas = [
            NS(choices=[NS(message=NS(content="", tool_calls=[llamada]))]),
            NS(choices=[NS(message=NS(content="Hubo 0 compras en 7 días.", tool_calls=None))]),
        ]
        cliente_llm = mock.Mock()
        cliente_llm.chat.completions.create.side_effect = respuestas
        adaptador = NS(_client=cliente_llm, settings=NS(model="m"))
        self.api.force_authenticate(self.admin)
        with mock.patch("agente.analisis.get_llm_adapter", return_value=adaptador):
            r = self.api.post("/api/v1/agente/admin/analisis/chat/", {"mensaje": "¿cómo vamos?"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["consultas"], [{"tema": "resumen", "dias": 7}])
        self.assertIn("7 días", r.data["respuesta"])
