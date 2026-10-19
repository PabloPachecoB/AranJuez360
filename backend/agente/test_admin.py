from types import SimpleNamespace
from unittest import mock

from rest_framework.test import APIClient, APITestCase

from usuarios.models import Usuario


class AnalisisAdminTests(APITestCase):
    """El asistente de análisis es solo para admin y consulta datos reales."""

    def setUp(self):
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
        llamada = SimpleNamespace(
            id="t1",
            function=SimpleNamespace(name="consultar_datos", arguments='{"tema": "resumen", "dias": 7}'),
        )
        respuestas = [
            SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="", tool_calls=[llamada]))]),
            SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Hubo 0 compras en 7 días.", tool_calls=None))]),
        ]
        cliente_llm = mock.Mock()
        cliente_llm.chat.completions.create.side_effect = respuestas
        adaptador = SimpleNamespace(_client=cliente_llm, settings=SimpleNamespace(model="m"))
        self.api.force_authenticate(self.admin)
        with mock.patch("agente.analisis.get_llm_adapter", return_value=adaptador):
            respuesta = self.api.post(
                "/api/v1/agente/admin/analisis/chat/", {"mensaje": "¿cómo vamos?"}, format="json"
            )
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["consultas"], [{"tema": "resumen", "dias": 7}])
        self.assertIn("7 días", respuesta.data["respuesta"])
