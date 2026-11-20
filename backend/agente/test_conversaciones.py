from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from usuarios.models import Usuario

from .models import AgentAction, ConversacionJarvis, MensajeJarvis


class ConversacionesJarvisApiTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user("ana", password="x", rol=Usuario.Rol.CLIENTE)
        self.otro_usuario = Usuario.objects.create_user("luis", password="x", rol=Usuario.Rol.CLIENTE)
        self.client.force_authenticate(self.usuario)

    def _crear_conversacion(self, usuario=None, **kwargs):
        return ConversacionJarvis.objects.create(usuario=usuario or self.usuario, **kwargs)

    def test_crea_y_lista_solo_las_conversaciones_activas_del_usuario(self):
        activa = self._crear_conversacion(titulo="Puntos")
        self._crear_conversacion(titulo="Archivada", archivada_en=activa.creada_en)
        self._crear_conversacion(usuario=self.otro_usuario, titulo="Ajena")

        creada = self.client.post("/api/v1/agente/conversaciones/", {"titulo": "Nueva"}, format="json")
        self.assertEqual(creada.status_code, 201)
        self.assertIn("id", creada.data)
        self.assertNotIn("usuario", creada.data)

        respuesta = self.client.get("/api/v1/agente/conversaciones/")
        self.assertEqual(respuesta.status_code, 200)
        titulos = {item["titulo"] for item in respuesta.data["results"]}
        self.assertEqual(titulos, {"Puntos", "Nueva"})

    def test_conversaciones_nuevas_reciben_threads_internos_unicos(self):
        primera = self._crear_conversacion()
        segunda = self._crear_conversacion()

        self.assertIsNotNone(primera.thread_id)
        self.assertNotEqual(primera.thread_id, segunda.thread_id)

    def test_no_permite_consultar_archivar_ni_leer_mensajes_de_otra_conversacion(self):
        ajena = self._crear_conversacion(usuario=self.otro_usuario, titulo="Privada")
        MensajeJarvis.objects.create(
            conversacion=ajena,
            rol=MensajeJarvis.Rol.USUARIO,
            contenido="Mensaje privado",
        )
        url = f"/api/v1/agente/conversaciones/{ajena.id}/"

        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(self.client.get(f"{url}mensajes/").status_code, 404)
        self.assertEqual(self.client.post(
            "/api/v1/agente/acciones/chat/",
            {"message": "¿Puedes ver esta conversación?", "conversation_id": str(ajena.id)},
            format="json",
        ).status_code, 404)

    def test_voz_no_puede_usar_conversacion_ajena_o_archivada(self):
        ajena = self._crear_conversacion(usuario=self.otro_usuario)
        archivada = self._crear_conversacion()
        archivada.archivada_en = archivada.creada_en
        archivada.save(update_fields=["archivada_en"])
        adapter = mock.Mock()
        adapter.transcribe.return_value = "Transcripción válida"

        for conversacion in (ajena, archivada):
            audio = SimpleUploadedFile("nota.m4a", b"audio-falso", content_type="audio/mp4")
            with mock.patch("agente.api.get_llm_adapter", return_value=adapter):
                respuesta = self.client.post(
                    "/api/v1/agente/acciones/voz/",
                    {"audio": audio, "conversation_id": str(conversacion.id)},
                    format="multipart",
                )
            self.assertEqual(respuesta.status_code, 404)

        self.assertFalse(MensajeJarvis.objects.exists())

    def test_archivar_conserva_los_mensajes_y_oculta_la_conversacion(self):
        conversacion = self._crear_conversacion(titulo="Conservar")
        mensaje = MensajeJarvis.objects.create(
            conversacion=conversacion,
            rol=MensajeJarvis.Rol.ASISTENTE,
            contenido="Respuesta auditable",
            metadatos={"interno": True},
        )
        pendiente = AgentAction.objects.create(
            usuario=self.usuario,
            conversacion=conversacion,
            thread_id=str(conversacion.thread_id),
            tipo_accion="PRUEBA",
        )

        respuesta = self.client.delete(f"/api/v1/agente/conversaciones/{conversacion.id}/")
        self.assertEqual(respuesta.status_code, 204)
        conversacion.refresh_from_db()
        pendiente.refresh_from_db()
        self.assertIsNotNone(conversacion.archivada_en)
        self.assertTrue(MensajeJarvis.objects.filter(pk=mensaje.pk).exists())
        self.assertEqual(pendiente.estado, AgentAction.Estado.RECHAZADA)
        self.assertTrue(AgentAction.objects.filter(pk=pendiente.pk).exists())
        self.assertEqual(self.client.get(f"/api/v1/agente/conversaciones/{conversacion.id}/").status_code, 404)
        self.assertEqual(self.client.post(
            "/api/v1/agente/acciones/chat/",
            {"message": "No debo enviarse", "conversation_id": str(conversacion.id)},
            format="json",
        ).status_code, 404)
        self.assertEqual(
            self.client.post(f"/api/v1/agente/acciones/{pendiente.id}/confirmar/", {}, format="json").status_code,
            400,
        )

    def test_accion_legacy_sin_conversacion_sigue_siendo_visible_para_su_propietario(self):
        accion = AgentAction.objects.create(
            usuario=self.usuario,
            thread_id="legacy-interno",
            tipo_accion="PRUEBA_LEGACY",
        )

        respuesta = self.client.get(f"/api/v1/agente/acciones/{accion.id}/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertIsNone(respuesta.data["conversation_id"])
        self.assertNotIn("thread_id", respuesta.data)
        self.assertEqual(
            self.client.post(f"/api/v1/agente/acciones/{accion.id}/rechazar/", {}, format="json").status_code,
            200,
        )
        self.assertFalse(MensajeJarvis.objects.exists())

    def test_lista_acciones_se_filtra_por_conversacion_sin_filtrar_ajenas(self):
        propia = self._crear_conversacion()
        otra_propia = self._crear_conversacion()
        ajena = self._crear_conversacion(usuario=self.otro_usuario)
        accion_propia = AgentAction.objects.create(
            usuario=self.usuario,
            conversacion=propia,
            thread_id=str(propia.thread_id),
            tipo_accion="PROPIA",
        )
        AgentAction.objects.create(
            usuario=self.usuario,
            conversacion=otra_propia,
            thread_id=str(otra_propia.thread_id),
            tipo_accion="OTRA",
        )
        AgentAction.objects.create(
            usuario=self.otro_usuario,
            conversacion=ajena,
            thread_id=str(ajena.thread_id),
            tipo_accion="AJENA",
        )

        respuesta = self.client.get(f"/api/v1/agente/acciones/?conversation_id={propia.id}")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual([item["id"] for item in respuesta.data["results"]], [accion_propia.id])
        self.assertNotIn("thread_id", respuesta.data["results"][0])

        ajenas = self.client.get(f"/api/v1/agente/acciones/?conversation_id={ajena.id}")
        self.assertEqual(ajenas.status_code, 200)
        self.assertEqual(ajenas.data["results"], [])
        self.assertEqual(
            self.client.get("/api/v1/agente/acciones/?conversation_id=no-es-un-uuid").status_code,
            400,
        )

    def test_historial_es_cronologico_y_no_expone_metadatos(self):
        conversacion = self._crear_conversacion()
        primero = MensajeJarvis.objects.create(
            conversacion=conversacion,
            rol=MensajeJarvis.Rol.USUARIO,
            contenido="Hola",
            metadatos={"secreto": "interno"},
        )
        segundo = MensajeJarvis.objects.create(
            conversacion=conversacion,
            rol=MensajeJarvis.Rol.ASISTENTE,
            contenido="Hola, ¿en qué te ayudo?",
        )

        respuesta = self.client.get(f"/api/v1/agente/conversaciones/{conversacion.id}/mensajes/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual([m["id"] for m in respuesta.data], [primero.id, segundo.id])
        self.assertNotIn("metadatos", respuesta.data[0])
        self.assertEqual(respuesta.data[0]["productos"], [])
        self.assertEqual(respuesta.data[0]["empresas"], [])
        self.assertEqual(self.client.post(
            f"/api/v1/agente/conversaciones/{conversacion.id}/mensajes/", {}, format="json"
        ).status_code, 405)
