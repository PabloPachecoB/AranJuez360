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
        resp = self._reservar(2, "MONEDAS")  # 2333,34 monedas > 500
        self.assertEqual(resp.status_code, 400)
        self.assertIn("No te alcanzan", resp.data["detail"])

    def test_no_cancela_a_menos_de_una_hora(self):
        Usuario.objects.filter(pk=self.cliente.pk).update(puntos_saldo=5000)
        reserva = self._reservar(1, "MONEDAS").data
        Funcion.objects.filter(pk=self.funcion.pk).update(inicio=timezone.now() + timedelta(minutes=30))
        resp = self.client.post(f"/api/v1/entretenimiento/reservas/{reserva['id']}/cancelar/")
        self.assertEqual(resp.status_code, 400)


class EscenarioAbiertoTests(APITestCase):
    """Propuesta del cliente → aprobación del admin → evento con cupos → reserva con QR → puerta."""

    def setUp(self):
        from .models import Espacio

        self.cliente = Usuario.objects.create_user("c", email="c@x.bo", password="x", rol=Usuario.Rol.CLIENTE)
        self.otro = Usuario.objects.create_user("o", email="o@x.bo", password="x", rol=Usuario.Rol.CLIENTE)
        self.admin = Usuario.objects.create_user("a", email="admin@x.bo", password="x", rol=Usuario.Rol.ADMIN)
        self.portero = Usuario.objects.create_user("p", password="x", rol=Usuario.Rol.PORTERO)
        self.espacio = Espacio.objects.create(nombre="Escenario", lugar="Piso 3", capacidad=50)
        self.inicio = (timezone.now() + timedelta(days=3)).replace(microsecond=0)

    def _proponer(self, usuario=None, **extra):
        self.client.force_authenticate(usuario or self.cliente)
        datos = {
            "espacio": self.espacio.id, "artista": "Juan y su guitarra", "titulo": "Acústico de sábado",
            "tipo": "MUSICA", "descripcion": "Covers en guitarra.", "necesidades": "Un micrófono",
            "inicio": self.inicio.isoformat(), "fin": (self.inicio + timedelta(hours=2)).isoformat(),
            "personas": 30, "acceso": "CUPOS",
        }
        datos.update(extra)
        return self.client.post("/api/v1/entretenimiento/propuestas/", datos, format="json")

    def _aprobar(self, propuesta_id, **datos):
        self.client.force_authenticate(self.admin)
        return self.client.post(f"/api/v1/admin/propuestas/{propuesta_id}/aprobar/", datos, format="json")

    def test_propuesta_llega_al_admin(self):
        from django.core import mail

        resp = self._proponer()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["estado"], "PENDIENTE")
        self.assertEqual(mail.outbox[-1].to, ["admin@x.bo"])
        self.client.force_authenticate(self.admin)
        pendientes = self.client.get("/api/v1/admin/propuestas/?estado=PENDIENTE").data["results"]
        self.assertEqual(pendientes[0]["solicitante_email"], "c@x.bo")

    def test_validaciones_de_la_propuesta(self):
        manana = timezone.now() + timedelta(hours=5)
        self.assertEqual(self._proponer(inicio=manana.isoformat(),
                                        fin=(manana + timedelta(hours=1)).isoformat()).status_code, 400)
        self.assertEqual(self._proponer(personas=80).status_code, 400)  # supera la capacidad
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.get("/api/v1/admin/propuestas/").status_code, 403)

    def test_aprobar_publica_con_cupos_y_bloquea_el_horario(self):
        propuesta = self._proponer().data
        aprobada = self._aprobar(propuesta["id"], acceso="CUPOS", cupos=2).data
        self.assertEqual(aprobada["estado"], "APROBADA")
        evento = self.client.get("/api/v1/entretenimiento/").data["eventos"][0]
        self.assertEqual((evento["acceso"], evento["cupos"], evento["disponibles"]), ("CUPOS", 2, 2))
        self.assertEqual(evento["organiza"], "Juan y su guitarra")
        # Otra solicitud en el mismo horario ya no se puede pedir.
        self.assertEqual(self._proponer(usuario=self.otro).status_code, 400)

    def test_rechazo_requiere_motivo(self):
        propuesta = self._proponer().data
        self.client.force_authenticate(self.admin)
        url = f"/api/v1/admin/propuestas/{propuesta['id']}/rechazar/"
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
        resp = self.client.post(url, {"motivo": "Ese día hay mantenimiento"}, format="json")
        self.assertEqual(resp.data["estado"], "RECHAZADA")

    def test_reservar_cupos_qr_y_puerta(self):
        propuesta = self._proponer().data
        evento_id = self._aprobar(propuesta["id"], acceso="CUPOS", cupos=2).data["evento"]

        self.client.force_authenticate(self.cliente)
        entrada = self.client.post("/api/v1/entretenimiento/entradas/", {"evento": evento_id, "cantidad": 2}, format="json")
        self.assertEqual(entrada.status_code, 201, entrada.data)
        self.assertTrue(entrada.data["qr"].startswith("paseo360://evento/"))
        # Ya tiene su cupo y no quedan más.
        self.assertEqual(self.client.post("/api/v1/entretenimiento/entradas/", {"evento": evento_id}).status_code, 400)
        self.client.force_authenticate(self.otro)
        self.assertEqual(self.client.post("/api/v1/entretenimiento/entradas/", {"evento": evento_id}).status_code, 400)

        # La puerta no la acepta con 3 días de anticipación; el día del evento sí, una sola vez.
        from .models import Evento

        self.client.force_authenticate(self.portero)
        url = f"/api/v1/porteria/entradas-evento/{entrada.data['codigo']}/"
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.post(url).status_code, 400)
        Evento.objects.filter(pk=evento_id).update(inicio=timezone.now() + timedelta(minutes=30))
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assertEqual(self.client.post(url).status_code, 400)

    def test_cancelar_libera_el_cupo_y_acceso_libre_no_se_reserva(self):
        propuesta = self._proponer().data
        evento_id = self._aprobar(propuesta["id"], acceso="CUPOS", cupos=1).data["evento"]
        self.client.force_authenticate(self.cliente)
        entrada = self.client.post("/api/v1/entretenimiento/entradas/", {"evento": evento_id}, format="json").data
        self.client.post(f"/api/v1/entretenimiento/entradas/{entrada['id']}/cancelar/")
        self.client.force_authenticate(self.otro)
        self.assertEqual(self.client.post("/api/v1/entretenimiento/entradas/", {"evento": evento_id}).status_code, 201)

        libre = Evento.objects.create(titulo="Feria", inicio=timezone.now() + timedelta(days=1))
        self.assertEqual(self.client.post("/api/v1/entretenimiento/entradas/", {"evento": libre.id}).status_code, 400)
