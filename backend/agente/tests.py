from decimal import Decimal
from types import SimpleNamespace
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from empresas.models import Empresa, Producto
from fidelizacion.models import Recompensa
from usuarios.models import Usuario

from .agent.checkpoints import CheckpointSettings, build_checkpoint_runtime
from .agent.service import AgentConversationService
from .config import LLMSettings
from .llm import LLMError
from .llm import LLMAdapter
from .models import AgentAction, ConversacionJarvis, MensajeJarvis
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

    def generar_titulo(self, mensaje_usuario, respuesta_asistente):
        return "Conversación con Jarvis"


class TituloLLMTests(SimpleTestCase):
    def test_title_model_configurado_y_fallback_al_modelo_principal(self):
        base = {
            "LLM_PROVIDER": "qwen_cloud",
            "QWEN_BASE_URL": "https://ejemplo.test/v1",
            "QWEN_API_KEY": "key",
            "QWEN_MODEL": "qwen3.8-flash",
        }
        self.assertEqual(
            LLMSettings.from_env({**base, "QWEN_TITLE_MODEL": "qwen3.5-flash"}).title_model,
            "qwen3.5-flash",
        )
        self.assertEqual(LLMSettings.from_env(base).title_model, "qwen3.8-flash")
        self.assertEqual(LLMSettings.from_env({**base, "QWEN_TITLE_MODEL": "  "}).title_model, "qwen3.8-flash")

    def test_generador_usa_title_model_y_limpia_salida(self):
        settings = LLMSettings(
            provider="qwen_cloud",
            model="qwen3.8-flash",
            title_model="qwen3.5-flash",
            base_url="https://ejemplo.test/v1",
            api_key="key",
            timeout_seconds=30,
            temperature=0,
            max_tokens=512,
        )
        cliente = mock.Mock()
        cliente.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='  "Título: Horarios del cine"  '))]
        )
        with mock.patch("agente.llm.OpenAI", return_value=cliente):
            titulo = LLMAdapter(settings).generar_titulo("¿Qué horarios hay?", "Hay funciones hoy.")

        self.assertEqual(titulo, "Horarios del cine")
        self.assertEqual(cliente.chat.completions.create.call_args.kwargs["model"], "qwen3.5-flash")


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
        self.servicio = servicio
        for objetivo, valor in (
            ("agente.api.get_conversation_service", lambda: servicio),
            ("agente.api.get_llm_adapter", lambda: self.llm),
            ("agente.agent.graph.get_llm_adapter", lambda: self.llm),
            ("agente.agent.service.get_llm_adapter", lambda: self.llm),
        ):
            patcher = mock.patch(objetivo, valor)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.client.force_authenticate(self.cliente)
        self.conversation_id = None

    def _chat(self, mensaje):
        datos = {"message": mensaje}
        if self.conversation_id:
            datos["conversation_id"] = self.conversation_id
        respuesta = self.client.post("/api/v1/agente/acciones/chat/", datos, format="json")
        if respuesta.status_code == 200:
            self.conversation_id = respuesta.data["conversation_id"]
        return respuesta

    def _crear_tarjetas_demo(self):
        from empresas.models import Categoria

        categoria = Categoria.objects.create(nombre="Comida")
        empresa = Empresa.objects.create(
            nombre="Cafe Tarjetas",
            email_contacto="tarjetas@paseo.bo",
            categoria=categoria,
            piso="2",
        )
        producto = Producto.objects.create(
            empresa=empresa,
            nombre="Capuchino Tarjetas",
            precio=Decimal("22"),
        )
        return empresa, producto

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

    def test_chat_de_texto_asigna_titulo_generado(self):
        self.llm.generar_titulo = mock.Mock(return_value="Consulta de puntos")
        respuesta = self._chat("¿Cuántos puntos tengo?")
        conversacion = ConversacionJarvis.objects.get(pk=respuesta.data["conversation_id"])

        self.assertEqual(conversacion.titulo, "Consulta de puntos")
        self.llm.generar_titulo.assert_called_once_with("¿Cuántos puntos tengo?", respuesta.data["text"])

    def test_voz_asigna_titulo_desde_la_transcripcion(self):
        self.llm.generar_titulo = mock.Mock(return_value="Saldo de monedas")
        audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
        respuesta = self.client.post("/api/v1/agente/acciones/voz/", {"audio": audio}, format="multipart")
        conversacion = ConversacionJarvis.objects.get(pk=respuesta.data["conversation_id"])

        self.assertEqual(conversacion.titulo, "Saldo de monedas")
        self.llm.generar_titulo.assert_called_once_with("cuántos puntos tengo", respuesta.data["text"])

    def test_titulo_existente_no_se_reemplaza(self):
        conversacion = ConversacionJarvis.objects.create(usuario=self.cliente, titulo="Título elegido")
        self.conversation_id = conversacion.id
        self.llm.generar_titulo = mock.Mock(return_value="Título nuevo")

        self._chat("Consulta nueva")
        conversacion.refresh_from_db()
        self.assertEqual(conversacion.titulo, "Título elegido")
        self.llm.generar_titulo.assert_not_called()

    def test_conversacion_antigua_sin_titulo_usa_su_primer_mensaje(self):
        conversacion = ConversacionJarvis.objects.create(usuario=self.cliente)
        MensajeJarvis.objects.create(
            conversacion=conversacion,
            rol=MensajeJarvis.Rol.USUARIO,
            contenido="Consulta inicial sobre cine",
            origen=MensajeJarvis.Origen.TEXTO,
        )
        self.conversation_id = conversacion.id
        self.llm.generar_titulo = mock.Mock(return_value="Horarios de cine")

        respuesta = self._chat("Otra pregunta")
        self.assertEqual(respuesta.status_code, 200)
        self.llm.generar_titulo.assert_called_once_with(
            "Consulta inicial sobre cine",
            respuesta.data["text"],
        )

    def test_fallo_o_salida_vacia_del_generador_usa_fallback_seguro(self):
        self.llm.generar_titulo = mock.Mock(return_value="")
        respuesta = self._chat("Consulta sobre horarios del cine para hoy")
        conversacion = ConversacionJarvis.objects.get(pk=respuesta.data["conversation_id"])
        self.assertEqual(conversacion.titulo, "Consulta sobre horarios del cine para")
        self.assertEqual(respuesta.status_code, 200)

    def test_excepcion_del_generador_no_rompe_el_chat_y_usa_fallback(self):
        self.llm.generar_titulo = mock.Mock(side_effect=RuntimeError("sin título"))
        respuesta = self._chat("Necesito información de restaurantes")
        conversacion = ConversacionJarvis.objects.get(pk=respuesta.data["conversation_id"])
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(conversacion.titulo, "Necesito información de restaurantes")

    def test_titulo_generado_nunca_supera_el_limite_del_modelo(self):
        self.llm.generar_titulo = mock.Mock(return_value="x" * 300)
        respuesta = self._chat("hola")
        conversacion = ConversacionJarvis.objects.get(pk=respuesta.data["conversation_id"])
        self.assertEqual(len(conversacion.titulo), 120)
        self.assertEqual(respuesta.status_code, 200)

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

    def test_acciones_no_exponen_thread_id(self):
        conversacion = ConversacionJarvis.objects.create(usuario=self.cliente)
        accion = AgentAction.objects.create(
            usuario=self.cliente,
            conversacion=conversacion,
            thread_id=str(conversacion.thread_id),
            tipo_accion="PRUEBA",
        )
        respuesta = self.client.get(f"/api/v1/agente/acciones/{accion.id}/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["conversation_id"], str(conversacion.id))
        self.assertNotIn("thread_id", respuesta.data)

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

    def test_voz_transcribe_y_responde(self):
        audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
        respuesta_grafo = {
            "presentation": {"text": "Respuesta por voz", "voz": "Respuesta por voz", "accion": None},
        }
        with mock.patch.object(self.servicio._graph, "invoke", return_value=respuesta_grafo) as invoke:
            resp = self.client.post(
                "/api/v1/agente/acciones/voz/",
                {"audio": audio},
                format="multipart",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["transcripcion"], "cuántos puntos tengo")
        self.assertEqual(resp.data["text"], "Respuesta por voz")
        self.assertIn("conversation_id", resp.data)
        conversacion = ConversacionJarvis.objects.get(pk=resp.data["conversation_id"])
        mensajes = list(conversacion.mensajes.order_by("creado_en", "id"))
        self.assertEqual(
            [(mensaje.rol, mensaje.origen, mensaje.contenido) for mensaje in mensajes],
            [
                (MensajeJarvis.Rol.USUARIO, MensajeJarvis.Origen.VOZ, "cuántos puntos tengo"),
                (MensajeJarvis.Rol.ASISTENTE, MensajeJarvis.Origen.TEXTO, "Respuesta por voz"),
            ],
        )
        self.assertEqual(
            invoke.call_args.kwargs["config"]["configurable"]["thread_id"],
            str(conversacion.thread_id),
        )

    def test_historial_persiste_tarjetas_de_respuesta_de_voz(self):
        empresa, producto = self._crear_tarjetas_demo()
        texto = f"Te recomiendo {producto.nombre} de {empresa.nombre}."
        audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
        with mock.patch.object(
            self.servicio._graph,
            "invoke",
            return_value={"presentation": {"text": texto, "voz": texto, "accion": None}},
        ):
            respuesta = self.client.post("/api/v1/agente/acciones/voz/", {"audio": audio}, format="multipart")

        historial = self.client.get(
            f"/api/v1/agente/conversaciones/{respuesta.data['conversation_id']}/mensajes/"
        )
        mensaje = historial.data[-1]
        self.assertEqual(mensaje["productos"], respuesta.data["productos"])
        self.assertEqual(mensaje["empresas"], respuesta.data["empresas"])

    def test_voz_continua_conversacion_activa_propia(self):
        conversacion = ConversacionJarvis.objects.create(usuario=self.cliente)
        MensajeJarvis.objects.create(
            conversacion=conversacion,
            rol=MensajeJarvis.Rol.USUARIO,
            contenido="Mensaje escrito anterior",
            origen=MensajeJarvis.Origen.TEXTO,
        )
        audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
        with mock.patch.object(
            self.servicio._graph,
            "invoke",
            return_value={"presentation": {"text": "Respuesta", "voz": "Respuesta", "accion": None}},
        ):
            respuesta = self.client.post(
                "/api/v1/agente/acciones/voz/",
                {"audio": audio, "conversation_id": str(conversacion.id)},
                format="multipart",
            )
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["conversation_id"], conversacion.id)
        self.assertEqual(conversacion.mensajes.filter(origen=MensajeJarvis.Origen.VOZ).count(), 1)

    def test_voz_rechaza_thread_id_del_cliente(self):
        audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
        respuesta = self.client.post(
            "/api/v1/agente/acciones/voz/",
            {"audio": audio, "thread_id": "cliente-no-controla-esto"},
            format="multipart",
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("thread_id", respuesta.data)

    def test_accion_propuesta_desde_voz_se_asocia_a_la_conversacion(self):
        recompensa = Recompensa.objects.first()
        self.llm.herramienta = ("canjear_recompensa", {"recompensa_id": recompensa.id})
        audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
        respuesta = self.client.post("/api/v1/agente/acciones/voz/", {"audio": audio}, format="multipart")

        self.assertEqual(respuesta.status_code, 200)
        accion = AgentAction.objects.get(pk=respuesta.data["accion"]["id"])
        self.assertEqual(accion.conversacion_id, respuesta.data["conversation_id"])

    def test_voz_rechaza_formato_desconocido(self):
        archivo = SimpleUploadedFile("virus.exe", b"x")
        resp = self.client.post("/api/v1/agente/acciones/voz/", {"audio": archivo}, format="multipart")
        self.assertEqual(resp.status_code, 400)

    def test_voz_sin_modelo_de_audio(self):
        audio = SimpleUploadedFile("nota.m4a", b"x")
        with mock.patch.object(self.llm, "transcribe", side_effect=LLMError("sin modelo")):
            resp = self.client.post("/api/v1/agente/acciones/voz/", {"audio": audio}, format="multipart")
        self.assertEqual(resp.status_code, 503)
        self.assertFalse(ConversacionJarvis.objects.exists())
        self.assertFalse(MensajeJarvis.objects.exists())

    def test_voz_vacia_no_crea_conversacion_ni_mensajes(self):
        audio = SimpleUploadedFile("nota.m4a", b"x")
        with mock.patch.object(self.llm, "transcribe", return_value=""):
            resp = self.client.post("/api/v1/agente/acciones/voz/", {"audio": audio}, format="multipart")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(ConversacionJarvis.objects.exists())
        self.assertFalse(MensajeJarvis.objects.exists())

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
    test_voz_continua_conversacion_activa_propia = test_voz_rechaza_thread_id_del_cliente = None
    test_accion_propuesta_desde_voz_se_asocia_a_la_conversacion = test_voz_vacia_no_crea_conversacion_ni_mensajes = None
    test_hablar_devuelve_mp3 = test_hablar_valida_texto_y_falla_con_gracia = None
    test_sin_elevenlabs_usa_edge_sin_etiquetas = test_si_falla_elevenlabs_respalda_con_edge = None
    test_requiere_autenticacion = None
    test_chat_persiste_turnos_y_no_expone_thread_id_del_cliente = None
    test_chat_de_texto_asigna_titulo_generado = test_voz_asigna_titulo_desde_la_transcripcion = None
    test_titulo_existente_no_se_reemplaza = test_fallo_o_salida_vacia_del_generador_usa_fallback_seguro = None
    test_conversacion_antigua_sin_titulo_usa_su_primer_mensaje = None
    test_excepcion_del_generador_no_rompe_el_chat_y_usa_fallback = None
    test_titulo_generado_nunca_supera_el_limite_del_modelo = None
    test_historial_persiste_tarjetas_de_respuesta_de_texto = None
    test_chat_usa_thread_interno_opaco = test_chat_rechaza_thread_id_del_cliente = None
    test_acciones_no_exponen_thread_id = None
    test_historial_persiste_tarjetas_de_respuesta_de_voz = None

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
        conversacion = ConversacionJarvis.objects.get(pk=resp.data["conversation_id"])
        accion_bd = AgentAction.objects.get(pk=accion["id"])
        self.assertEqual(accion_bd.conversacion_id, conversacion.id)
        self.assertEqual(accion_bd.thread_id, str(conversacion.thread_id))
        self.assertEqual(self._saldo(), 5000)  # todavía no cobró

        ok = self._confirmar(accion["id"])
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["resultado"]["tipo"], "canje")
        self.assertEqual(
            MensajeJarvis.objects.filter(conversacion=conversacion)
            .order_by("-creado_en", "-id")
            .first()
            .contenido,
            ok.data["text"],
        )
        self.assertEqual(self._saldo(), 4950)
        self.assertEqual(self._confirmar(accion["id"]).status_code, 400)  # no se ejecuta dos veces

    def test_rechazar_accion_persiste_mensaje_en_la_conversacion(self):
        self.llm.herramienta = ("canjear_recompensa", {"recompensa_id": self.parqueo.id})
        respuesta = self._chat("canjea")
        conversacion = ConversacionJarvis.objects.get(pk=respuesta.data["conversation_id"])
        accion_id = respuesta.data["accion"]["id"]

        rechazo = self.client.post(f"/api/v1/agente/acciones/{accion_id}/rechazar/", {}, format="json")
        self.assertEqual(rechazo.status_code, 200)
        self.assertEqual(
            conversacion.mensajes.order_by("-creado_en", "-id").first().contenido,
            "Listo, no realicé esa acción.",
        )
        self.assertEqual(AgentAction.objects.get(pk=accion_id).estado, AgentAction.Estado.RECHAZADA)

    def test_reanudar_accion_asociada_usa_thread_de_la_conversacion(self):
        self.llm.herramienta = ("canjear_recompensa", {"recompensa_id": self.parqueo.id})
        respuesta = self._chat("canjea")
        accion = AgentAction.objects.select_related("conversacion").get(pk=respuesta.data["accion"]["id"])
        accion.thread_id = "legacy-no-debe-usarse"
        accion.save(update_fields=["thread_id"])

        with mock.patch.object(
            self.servicio._graph,
            "invoke",
            return_value={"presentation": {"text": "ok"}},
        ) as invoke:
            self.servicio.resume_confirmation(self.cliente, accion)

        self.assertEqual(
            invoke.call_args.kwargs["config"]["configurable"]["thread_id"],
            str(accion.conversacion.thread_id),
        )

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
