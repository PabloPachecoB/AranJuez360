from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from fidelizacion.models import Recompensa

from .llm import LLMError
from .models import AgentAction, ConversacionJarvis, MensajeJarvis
from .testing import AgentApiTestMixin
from .voz import VozError


class VoiceApiTests(AgentApiTestMixin, APITestCase):
    def test_voz_transcribe_y_responde(self):
        audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
        respuesta_grafo = {
            "presentation": {"text": "Respuesta por voz", "voz": "Respuesta por voz", "accion": None},
        }
        with mock.patch.object(self.servicio._graph, "invoke", return_value=respuesta_grafo) as invoke:
            resp = self.client.post("/api/v1/agente/acciones/voz/", {"audio": audio}, format="multipart")
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
        self.assertEqual(invoke.call_args.kwargs["config"]["configurable"]["thread_id"], str(conversacion.thread_id))

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
        self.assertEqual(
            str(respuesta.data["conversation_id"]),
            str(conversacion.id),
        )
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

        cache.clear()
        with mock.patch.dict("os.environ", {"JARVIS_TTS_PROVIDER": "", "ELEVENLABS_API_KEY": ""}), mock.patch.object(voz, "_edge", return_value=b"mp3") as edge:
            self.assertEqual(voz.sintetizar("[warmly] Hola prueba-edge"), b"mp3")
        edge.assert_called_once()

    def test_si_falla_elevenlabs_respalda_con_edge(self):
        from . import voz

        with mock.patch.dict("os.environ", {"JARVIS_TTS_PROVIDER": "elevenlabs", "ELEVENLABS_API_KEY": "x"}), mock.patch.object(
            voz, "_elevenlabs", side_effect=voz.VozError("sin créditos")
        ), mock.patch.object(voz, "_edge", return_value=b"mp3-edge"):
            self.assertEqual(voz.sintetizar("Hola prueba-respaldo"), b"mp3-edge")
        self.assertEqual(voz.quitar_emociones("[sighs] Lo siento.  [warmly] Ya cerró."), "Lo siento. Ya cerró.")

    def test_fish_audio_recibe_etiquetas_y_configuracion(self):
        from . import voz

        with mock.patch.dict("os.environ", {
            "JARVIS_TTS_PROVIDER": "fish_audio",
            "FISH_AUDIO_API_KEY": "clave-de-prueba",
            "FISH_AUDIO_MODEL": "s2.1-pro-free",
            "FISH_AUDIO_VOICE_ID": "voz-de-prueba",
        }), mock.patch.object(voz, "_fish_audio", return_value=b"mp3-fish") as fish:
            self.assertEqual(voz.sintetizar("[warmly] Hola prueba-fish"), b"mp3-fish")
        fish.assert_called_once_with("[warmly] Hola prueba-fish", "clave-de-prueba")

    def test_fish_audio_usa_api_mp3_modelo_y_timeout(self):
        from . import voz

        respuesta = mock.Mock(status_code=200, content=b"mp3-fish")
        with mock.patch.dict("os.environ", {
            "FISH_AUDIO_MODEL": "s2.1-pro-free", "FISH_AUDIO_VOICE_ID": "voz-de-prueba",
        }), mock.patch.object(voz.requests, "post", return_value=respuesta) as post:
            self.assertEqual(voz._fish_audio("[excited] Hola", "clave-de-prueba"), b"mp3-fish")
        post.assert_called_once_with(
            "https://api.fish.audio/v1/tts",
            headers={"Authorization": "Bearer clave-de-prueba", "model": "s2.1-pro-free"},
            json={"text": "[excited] Hola", "reference_id": "voz-de-prueba", "format": "mp3"},
            timeout=30,
        )

    def test_fish_sin_clave_usa_edge_y_falla_remota_tambien(self):
        from . import voz

        with mock.patch.dict("os.environ", {"JARVIS_TTS_PROVIDER": "fish_audio", "FISH_AUDIO_API_KEY": ""}), mock.patch.object(
            voz, "_edge", return_value=b"mp3-edge"
        ) as edge:
            self.assertEqual(voz.sintetizar("Hola fish-sin-clave"), b"mp3-edge")
        edge.assert_called_once()

        with mock.patch.dict("os.environ", {"JARVIS_TTS_PROVIDER": "fish_audio", "FISH_AUDIO_API_KEY": "x"}), mock.patch.object(
            voz, "_fish_audio", side_effect=voz.VozError("Fish Audio devolvió HTTP 503.")
        ), mock.patch.object(voz, "_edge", return_value=b"mp3-respaldo"):
            self.assertEqual(voz.sintetizar("Hola fish-falla-remota"), b"mp3-respaldo")

    def test_cache_separa_proveedor_de_voz(self):
        from django.core.cache import cache

        from . import voz

        cache.clear()
        texto = "Cache por proveedor prueba"
        with mock.patch.dict("os.environ", {
            "JARVIS_TTS_PROVIDER": "elevenlabs", "ELEVENLABS_API_KEY": "eleven-key",
            "ELEVENLABS_MODEL": "eleven_v3", "ELEVENLABS_VOICE_ID": "voz-a",
        }), mock.patch.object(voz, "_elevenlabs", return_value=b"audio-eleven"):
            self.assertEqual(voz.sintetizar(texto), b"audio-eleven")
        with mock.patch.dict("os.environ", {
            "JARVIS_TTS_PROVIDER": "fish_audio", "FISH_AUDIO_API_KEY": "fish-key",
            "FISH_AUDIO_MODEL": "s2.1-pro", "FISH_AUDIO_VOICE_ID": "voz-b",
        }), mock.patch.object(voz, "_fish_audio", return_value=b"audio-fish") as fish:
            self.assertEqual(voz.sintetizar(texto), b"audio-fish")
        fish.assert_called_once()

    def test_hablar_valida_texto_y_falla_con_gracia(self):
        self.assertEqual(self.client.get("/api/v1/agente/acciones/hablar/").status_code, 400)
        with mock.patch("agente.api.sintetizar", side_effect=VozError("sin red")):
            resp = self.client.get("/api/v1/agente/acciones/hablar/", {"texto": "hola"})
        self.assertEqual(resp.status_code, 503)
