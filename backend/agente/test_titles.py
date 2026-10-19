from types import SimpleNamespace
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from .config import LLMSettings
from .llm import LLMAdapter
from .models import ConversacionJarvis, MensajeJarvis
from .testing import AgentApiTestMixin


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
            provider="qwen_cloud", model="qwen3.8-flash", title_model="qwen3.5-flash",
            base_url="https://ejemplo.test/v1", api_key="key", timeout_seconds=30,
            temperature=0, max_tokens=512,
        )
        cliente = mock.Mock()
        cliente.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='  "Título: Horarios del cine"  '))]
        )
        with mock.patch("agente.llm.OpenAI", return_value=cliente):
            titulo = LLMAdapter(settings).generar_titulo("¿Qué horarios hay?", "Hay funciones hoy.")

        self.assertEqual(titulo, "Horarios del cine")
        self.assertEqual(cliente.chat.completions.create.call_args.kwargs["model"], "qwen3.5-flash")


class ConversationTitleTests(AgentApiTestMixin, APITestCase):
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
            conversacion=conversacion, rol=MensajeJarvis.Rol.USUARIO,
            contenido="Consulta inicial sobre cine", origen=MensajeJarvis.Origen.TEXTO,
        )
        self.conversation_id = conversacion.id
        self.llm.generar_titulo = mock.Mock(return_value="Horarios de cine")

        respuesta = self._chat("Otra pregunta")
        self.assertEqual(respuesta.status_code, 200)
        self.llm.generar_titulo.assert_called_once_with("Consulta inicial sobre cine", respuesta.data["text"])

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
