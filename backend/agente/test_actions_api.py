from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.utils import timezone
from rest_framework.test import APITestCase

from entretenimiento.models import Funcion, Pelicula
from fidelizacion.models import Recompensa
from usuarios.models import Usuario

from .models import AgentAction, ConversacionJarvis, MensajeJarvis
from .testing import AgentApiTestMixin


class AccionesJarvisTests(AgentApiTestMixin, APITestCase):
    """Jarvis propone acciones y solo se ejecutan al confirmar."""

    def setUp(self):
        super().setUp()
        Usuario.objects.filter(pk=self.cliente.pk).update(puntos_saldo=5000)
        self.parqueo = Recompensa.objects.create(nombre="Parqueo", costo_puntos=50, categoria="PARQUEO")
        pelicula = Pelicula.objects.create(titulo="Galaxia")
        self.funcion = Funcion.objects.create(
            pelicula=pelicula,
            inicio=timezone.now() + timedelta(hours=5),
            precio=35,
        )

    def _saldo(self):
        self.cliente.refresh_from_db()
        return self.cliente.puntos_saldo

    def _confirmar(self, accion_id):
        return self.client.post(f"/api/v1/agente/acciones/{accion_id}/confirmar/", {}, format="json")

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
        self.assertEqual(self._saldo(), 5000)

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
        self.assertEqual(self._confirmar(accion["id"]).status_code, 400)

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

        self.llm.herramienta = (
            "reservar_entradas_cine",
            {"funcion_id": self.funcion.id, "cantidad": 2, "metodo": "MONEDAS"},
        )
        accion = self._chat("dos entradas").data["accion"]
        self.assertIn("2333,34 monedas", accion["resumen"])
        self.assertEqual(self._confirmar(accion["id"]).status_code, 200)
        self.assertEqual(self._saldo(), Decimal("2666.66"))
        reserva = ReservaCine.objects.get()

        self.llm.herramienta = ("cancelar_reserva_cine", {"reserva_id": reserva.id})
        accion = self._chat("cancela").data["accion"]
        self.assertEqual(self._confirmar(accion["id"]).status_code, 200)
        self.assertEqual(self._saldo(), 5000)

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
