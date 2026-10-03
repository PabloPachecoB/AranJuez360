from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from fidelizacion.models import PuntoEscaneo
from usuarios.models import Usuario

from .models import Evento, Funcion, Pelicula


class DiversionTests(APITestCase):
    def setUp(self):
        ahora = timezone.now()
        self.peli = Pelicula.objects.create(titulo="Galaxia", genero="Ciencia ficción")
        Funcion.objects.create(pelicula=self.peli, inicio=ahora + timedelta(hours=3), precio=35)
        Funcion.objects.create(pelicula=self.peli, inicio=ahora - timedelta(hours=3))  # ya pasó
        Funcion.objects.create(pelicula=self.peli, inicio=ahora + timedelta(days=20))  # fuera de cartelera
        Pelicula.objects.create(titulo="Próximamente")
        Pelicula.objects.create(titulo="Inactiva", activo=False)
        Evento.objects.create(titulo="Concierto", inicio=ahora + timedelta(days=2), destacado=True)
        Evento.objects.create(titulo="Expo", inicio=ahora - timedelta(days=1), fin=ahora + timedelta(days=3))
        Evento.objects.create(titulo="Pasado", inicio=ahora - timedelta(days=5), fin=ahora - timedelta(days=4))
        PuntoEscaneo.objects.create(nombre="Juegos", tipo="ACTIVIDAD")
        PuntoEscaneo.objects.create(nombre="Puerta", tipo="ENTRADA")

    def test_resumen_publico(self):
        data = self.client.get("/api/v1/entretenimiento/").data
        self.assertEqual([p["titulo"] for p in data["cartelera"]], ["Galaxia", "Próximamente"])
        self.assertEqual(len(data["cartelera"][0]["funciones"]), 1)
        self.assertEqual([e["titulo"] for e in data["eventos"]], ["Expo", "Concierto"])
        self.assertEqual(data["destacado"]["titulo"], "Concierto")
        self.assertTrue(data["destacado"]["gratis"])
        self.assertEqual([a["nombre"] for a in data["actividades"]], ["Juegos"])

    def test_detalle_pelicula(self):
        data = self.client.get(f"/api/v1/entretenimiento/peliculas/{self.peli.id}/").data
        self.assertEqual(data["titulo"], "Galaxia")
        self.assertEqual(len(data["funciones"]), 1)

    def test_solo_admin_administra(self):
        cliente = Usuario.objects.create_user("c", password="x", rol=Usuario.Rol.CLIENTE)
        self.client.force_authenticate(cliente)
        self.assertEqual(self.client.post("/api/v1/admin/eventos/", {}).status_code, 403)
        admin = Usuario.objects.create_user("a", password="x", rol=Usuario.Rol.ADMIN)
        self.client.force_authenticate(admin)
        inicio = timezone.now() + timedelta(days=1)
        resp = self.client.post("/api/v1/admin/eventos/", {
            "titulo": "Feria", "inicio": inicio.isoformat(), "fin": (inicio - timedelta(hours=1)).isoformat(),
        }, format="json")
        self.assertEqual(resp.status_code, 400)  # fin antes del inicio



class ReservasTests(APITestCase):
    def setUp(self):
        self.cliente = Usuario.objects.create_user("c", password="x", rol=Usuario.Rol.CLIENTE)
        Usuario.objects.filter(pk=self.cliente.pk).update(puntos_saldo=500)
        peli = Pelicula.objects.create(titulo="Galaxia")
        self.funcion = Funcion.objects.create(
            pelicula=peli, inicio=timezone.now() + timedelta(hours=3), precio=35, capacidad=3
        )
        self.client.force_authenticate(self.cliente)

    def _reservar(self, cantidad, metodo="BOLETERIA"):
        return self.client.post("/api/v1/entretenimiento/reservas/",
                                {"funcion": self.funcion.id, "cantidad": cantidad, "metodo": metodo}, format="json")

    def test_reserva_en_boleteria_respeta_capacidad(self):
        resp = self._reservar(2)
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(len(resp.data["codigo"]), 8)
        self.assertEqual(self._reservar(2).status_code, 400)  # solo queda 1 butaca
        self.assertEqual(self._reservar(1).status_code, 201)

    def test_monedas_insuficientes(self):
        resp = self._reservar(2, "MONEDAS")  # 700 monedas > 500
        self.assertEqual(resp.status_code, 400)
        self.assertIn("No te alcanzan", resp.data["detail"])

    def test_no_cancela_a_menos_de_una_hora(self):
        reserva = self._reservar(1, "MONEDAS").data
        Funcion.objects.filter(pk=self.funcion.pk).update(inicio=timezone.now() + timedelta(minutes=30))
        resp = self.client.post(f"/api/v1/entretenimiento/reservas/{reserva['id']}/cancelar/")
        self.assertEqual(resp.status_code, 400)
