from datetime import date, timedelta
from unittest import mock

from django.core.cache import cache, caches
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from sorteo.models import Campania, DesafioContacto

CODIGO_FIJO = "654321"


@override_settings(SORTEO_CANAL_CELULAR="consola")
class SorteoBase(TestCase):
    """Campaña activa, código de verificación fijo y cliente de API."""

    URL = "/api/v1/sorteo/"
    DATOS = {
        "nombres": "María José", "apellidos": "Gómez Pérez", "correo": "maria@ejemplo.com",
        "celular": "71234567", "canal": "CORREO", "acepta_terminos": True,
    }

    def setUp(self):
        cache.clear()  # reinicia el límite de intentos (throttling)
        caches["sorteo_throttle"].clear()
        parche = mock.patch("sorteo.services.nuevo_codigo_verificacion", return_value=CODIGO_FIJO)
        parche.start()
        self.addCleanup(parche.stop)
        self.campania = Campania.objects.create(estado=Campania.Estado.ACTIVA, fecha_sorteo=date(2026, 12, 20))
        self.client = APIClient()

    # --- ayudas ---
    def post(self, ruta, datos=None, **extra):
        return self.client.post(f"{self.URL}{ruta}", datos or {}, format="json", **extra)

    def get(self, ruta, **extra):
        return self.client.get(f"{self.URL}{ruta}", **extra)

    def envejecer(self, destino, segundos=120):
        """Adelanta el reloj de los desafíos de un contacto para saltar la espera de reenvío."""
        DesafioContacto.objects.filter(destino=destino).update(
            creado_en=timezone.now() - timedelta(seconds=segundos),
        )

    def registrar(self, **cambios):
        return self.post("registro/", {**self.DATOS, **cambios})

    def activar(self, **cambios):
        """Registra y verifica. Devuelve la respuesta de `verificar/` (sesion y tarjeta)."""
        resp = self.registrar(**cambios)
        self.assertEqual(resp.status_code, 201, resp.data)
        ok = self.post("verificar/", {"desafio": resp.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(ok.status_code, 200, ok.data)
        return ok

    def auth(self, sesion):
        return {"HTTP_AUTHORIZATION": f"Tarjeta {sesion}"}
