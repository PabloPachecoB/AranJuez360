"""Fixtures compartidos para las pruebas de la aplicación agente.

Este módulo no empieza por ``test_`` para que Django no intente descubrirlo como
una suite independiente. El mixin tampoco hereda de ``TestCase``: cada módulo
de pruebas declara su propia clase de caso.
"""

from decimal import Decimal
from unittest import mock

from empresas.models import Empresa, Producto
from fidelizacion.models import Recompensa
from usuarios.models import Usuario

from .agent.checkpoints import CheckpointSettings, build_checkpoint_runtime
from .agent.service import AgentConversationService


class FakeLLM:
    """Sustituye al proveedor real: no gasta cuota ni necesita red."""

    soporta_audio = True

    def __init__(self):
        self.llamadas = []
        self.herramienta = None

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


class AgentApiTestMixin:
    """Estado común para casos de API de Jarvis; no es una clase de pruebas."""

    def setUp(self):
        super().setUp()
        self.cliente = Usuario.objects.create_user(
            "cli", password="x", first_name="Ana", rol=Usuario.Rol.CLIENTE, puntos_saldo=420
        )
        Recompensa.objects.create(nombre="Café gratis", costo_puntos=300)
        self.llm = FakeLLM()
        memoria = build_checkpoint_runtime(CheckpointSettings(backend="memory", sqlite_path=""))
        with mock.patch("agente.agent.service.get_checkpoint_runtime", return_value=memoria):
            self.servicio = AgentConversationService()
        for objetivo, valor in (
            ("agente.api.get_conversation_service", lambda: self.servicio),
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
