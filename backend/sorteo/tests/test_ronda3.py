"""Tercera ronda de exploración: admin, JSON anidado, cabeceras, fechas de campaña y contactos editados."""

from datetime import date
from io import StringIO

from django.contrib.messages import get_messages
from django.core.cache import caches
from django.core.exceptions import ValidationError
from django.core.management import CommandError, call_command
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from unittest import mock

from sorteo.models import Campania, CuentaFidelizacion, DesafioContacto
from usuarios.models import Usuario

from .base import CODIGO_FIJO, SorteoBase

ANIDADO = b"[" * 3000 + b"]" * 3000


def cuenta_verificada(correo, celular, nombres="Beto"):
    return CuentaFidelizacion.objects.create(
        nombres=nombres, apellidos="Dos", correo=correo, celular=celular,
        estado=CuentaFidelizacion.Estado.ACTIVA, correo_verificado_en=timezone.now(), celular_verificado_en=timezone.now(),
    )


# --- Medio 1: un contacto editado deja de estar verificado --------------------------------------

class ContactoEditadoTests(SorteoBase):
    def test_cambiar_el_correo_le_quita_la_verificacion(self):
        cuenta = cuenta_verificada("beto@ejemplo.com", "61700001")
        cuenta.correo = "nuevo@ejemplo.com"
        cuenta.save()
        cuenta.refresh_from_db()
        self.assertIsNone(cuenta.correo_verificado_en)
        self.assertIsNotNone(cuenta.celular_verificado_en)  # el celular no cambió: sigue verificado
        self.assertEqual(cuenta.contactos_desverificados, ["correo"])
        self.assertEqual(cuenta.correo_canonico, "nuevo@ejemplo.com")

    def test_cambiar_el_celular_le_quita_la_verificacion(self):
        cuenta = cuenta_verificada("beto@ejemplo.com", "61700001")
        cuenta.celular = "61700009"
        cuenta.save(update_fields=["celular"])
        cuenta.refresh_from_db()
        self.assertIsNone(cuenta.celular_verificado_en)
        self.assertIsNotNone(cuenta.correo_verificado_en)

    def test_guardar_sin_cambiar_el_contacto_no_toca_la_verificacion(self):
        cuenta = cuenta_verificada("beto@ejemplo.com", "61700001")
        cuenta.nombres = "Alberto"
        cuenta.save()
        cuenta.refresh_from_db()
        self.assertIsNotNone(cuenta.correo_verificado_en)
        self.assertEqual(cuenta.contactos_desverificados, [])

    def test_el_dueno_real_del_correo_nuevo_no_recibe_acceso_a_la_tarjeta_ajena(self):
        # Antes: el admin cambiaba el correo, quedaba «verificado» y su dueño real recibía un código de recuperación.
        cuenta = cuenta_verificada("beto@ejemplo.com", "61700001")
        cuenta.correo = "nuevo@ejemplo.com"
        cuenta.save()
        r = self.registrar(correo="nuevo@ejemplo.com", celular="61700099", nombres="Dueña", apellidos="Real")
        desafio = DesafioContacto.objects.get(desafio=r.data["desafio"])
        self.assertEqual(desafio.proposito, DesafioContacto.Proposito.REGISTRO)
        self.assertNotEqual(desafio.cuenta_id, cuenta.pk)
        ok = self.post("verificar/", {"desafio": r.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(ok.data["tarjeta"]["primer_nombre"], "Dueña")

    def test_verificar_un_contacto_no_lo_desverifica(self):
        self.activar()
        cuenta = CuentaFidelizacion.objects.get()
        self.assertIsNotNone(cuenta.correo_verificado_en)


# --- Medio 2 y menores del admin ---------------------------------------------------------------

class AdminCuentaTests(TestCase):
    def setUp(self):
        self.su = Usuario.objects.create_user("root", password="x", is_staff=True, is_superuser=True, rol=Usuario.Rol.ADMIN)
        self.client.force_login(self.su)
        self.a = cuenta_verificada("a@ejemplo.com", "61700001", "Ana")
        self.b = cuenta_verificada("b@ejemplo.com", "61700002", "Beto")

    def guardar(self, cuenta, **cambios):
        datos = {"nombres": cuenta.nombres, "apellidos": cuenta.apellidos, "correo": cuenta.correo, "celular": cuenta.celular,
                 "estado": cuenta.estado, "usuario": "", "acepto_terminos_en_0": "", "acepto_terminos_en_1": "",
                 "codigos-TOTAL_FORMS": "0", "codigos-INITIAL_FORMS": "0", "codigos-MIN_NUM_FORMS": "0", "codigos-MAX_NUM_FORMS": "0"}
        datos.update(cambios)
        return self.client.post(f"/admin/sorteo/cuentafidelizacion/{cuenta.pk}/change/", datos)

    def test_poner_un_correo_ya_verificado_en_otra_cuenta_no_da_500(self):
        r = self.guardar(self.b, correo="a@ejemplo.com")
        self.assertEqual(r.status_code, 302)
        self.b.refresh_from_db()
        self.a.refresh_from_db()
        self.assertEqual(self.b.correo, "a@ejemplo.com")
        self.assertIsNone(self.b.correo_verificado_en)       # el de Beto queda sin verificar
        self.assertIsNotNone(self.a.correo_verificado_en)    # Ana sigue siendo la dueña comprobada

    def test_avisa_que_el_contacto_quedo_sin_verificar(self):
        r = self.guardar(self.b, correo="otro@ejemplo.com")
        avisos = [str(m) for m in get_messages(r.wsgi_request)]
        self.assertTrue(any("SIN verificar" in m for m in avisos), avisos)

    def test_valida_el_celular_como_el_registro(self):
        malos = {
            "7123 456": "Celular incompleto.",
            "abcdefgh": "El celular solo lleva números.",
            "51234567": "El celular empieza con 6 o 7.",
            "+5917123": "Celular incompleto.",
        }
        for malo, mensaje in malos.items():
            with self.subTest(malo=malo):
                r = self.guardar(self.a, celular=malo)
                self.assertEqual(r.status_code, 200)  # vuelve al formulario con el error
                self.assertContains(r, mensaje)
        self.a.refresh_from_db()
        self.assertEqual(self.a.celular, "61700001")

    def test_valida_nombres_y_correo(self):
        r = self.guardar(self.a, nombres="<b>x</b> 123")
        self.assertContains(r, "Usa solo letras")
        r = self.guardar(self.a, correo="a@localhost")
        self.assertContains(r, "Correo incompleto.")
        r = self.guardar(self.a, nombres="ana maría", apellidos="DE LA CRUZ")
        self.assertEqual(r.status_code, 302)
        self.a.refresh_from_db()
        self.assertEqual((self.a.nombres, self.a.apellidos), ("Ana María", "De la Cruz"))

    def test_una_cuenta_verificada_no_vuelve_a_pendiente(self):
        r = self.guardar(self.a, estado="PENDIENTE")
        self.assertContains(r, "no puede volver a «pendiente»")
        self.a.refresh_from_db()
        self.assertEqual(self.a.estado, CuentaFidelizacion.Estado.ACTIVA)
        self.assertEqual(self.guardar(self.a, estado="BLOQUEADA").status_code, 302)

    def test_el_listado_no_hace_una_consulta_por_fila(self):
        def consultas():
            with CaptureQueriesContext(connection) as q:
                self.assertEqual(self.client.get("/admin/sorteo/cuentafidelizacion/").status_code, 200)
            return len(q)

        antes = consultas()
        for i in range(15):
            cuenta_verificada(f"x{i}@ejemplo.com", f"617001{i:02d}", "Equis")
        self.assertEqual(consultas(), antes)

    def test_la_columna_de_duplicados_cuenta_bien(self):
        CuentaFidelizacion.objects.create(nombres="Ana", apellidos="Alias", correo="a+2@ejemplo.com", celular="61700077")
        r = self.client.get("/admin/sorteo/cuentafidelizacion/")
        self.assertContains(r, "⚠ 1", count=2)  # Ana y su alias se señalan mutuamente


class AdminCampaniaTests(TestCase):
    def setUp(self):
        self.su = Usuario.objects.create_user("root", password="x", is_staff=True, is_superuser=True, rol=Usuario.Rol.ADMIN)
        self.client.force_login(self.su)

    def crear(self, **datos):
        base = {"nombre": "Otra", "estado": "BORRADOR", "bs_por_punto": "200", "inicio": "", "cierre": "", "fecha_sorteo": ""}
        return self.client.post("/admin/sorteo/campania/add/", {**base, **datos})

    def test_segunda_campania_activa_muestra_un_mensaje_claro(self):
        Campania.objects.create(estado=Campania.Estado.ACTIVA)
        r = self.crear(estado="ACTIVA")
        self.assertContains(r, "Ya hay otra campaña activa")
        self.assertNotContains(r, "sorteo_una_campania_activa")
        self.assertEqual(Campania.objects.filter(estado="ACTIVA").count(), 1)

    def test_fechas_en_orden(self):
        r = self.crear(inicio="2026-12-31", cierre="2026-12-01")
        self.assertContains(r, "El cierre no puede ser anterior al inicio")
        r = self.crear(inicio="2026-12-01", cierre="2026-12-20", fecha_sorteo="2026-12-10")
        self.assertContains(r, "El sorteo no puede ser anterior al cierre")
        r = self.crear(inicio="2026-12-01", fecha_sorteo="2026-11-01")
        self.assertContains(r, "El sorteo no puede ser anterior al inicio")
        self.assertEqual(Campania.objects.count(), 0)
        self.assertEqual(self.crear(inicio="2026-12-01", cierre="2026-12-20", fecha_sorteo="2026-12-20").status_code, 302)

    def test_el_comando_tambien_valida_las_fechas(self):
        with self.assertRaises(CommandError):
            call_command("crear_campania_sorteo", "--inicio", "2026-12-31", "--cierre", "2026-12-01", stdout=StringIO())
        self.assertEqual(Campania.objects.count(), 0)

    def test_fechas_sueltas_son_validas(self):
        Campania(fecha_sorteo=date(2026, 12, 20)).full_clean()
        with self.assertRaises(ValidationError):
            Campania(inicio=date(2026, 12, 2), cierre=date(2026, 12, 1)).full_clean()


# --- Menores de la API --------------------------------------------------------------------------

class ApiRobustaTests(SorteoBase):
    def test_json_anidado_en_exceso_responde_400_y_no_500(self):
        for ruta in ("registro/", "verificar/", "recuperar/", "reenviar/"):
            with self.subTest(ruta=ruta):
                r = self.client.post(f"{self.URL}{ruta}", ANIDADO, content_type="application/json")
                self.assertEqual(r.status_code, 400)
                self.assertIn("anidación", r.data["detail"])

    def test_el_arreglo_cubre_tambien_el_login_existente(self):
        r = self.client.post("/api/v1/auth/login/", ANIDADO, content_type="application/json")
        self.assertEqual(r.status_code, 400)

    def test_el_json_normal_y_los_formularios_siguen_funcionando(self):
        self.assertEqual(self.registrar().status_code, 201)
        r = self.client.post(f"{self.URL}recuperar/", {"contacto": "nadie@ejemplo.com"})  # multipart por defecto
        self.assertEqual((r.status_code, r.data["codigo"]), (404, "sin_tarjeta"))  # se leyó bien el formulario

    def test_el_429_trae_retry_after(self):
        datos = {"desafio": "00000000-0000-4000-8000-000000000000", "codigo": "123456"}
        with mock.patch.dict("rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES", {"sorteo_verificar": "1/min"}):
            self.post("verificar/", datos)
            r = self.post("verificar/", datos)
        self.assertEqual(r.status_code, 429)
        self.assertTrue(1 <= int(r["Retry-After"]) <= 60)
        self.assertEqual(r.data["codigo"], "demasiadas_peticiones")

    def test_las_respuestas_no_se_guardan_en_cache(self):
        resp = self.activar()
        self.assertEqual(resp["Cache-Control"], "no-store")  # la respuesta de verificar trae la sesión
        self.assertEqual(self.get("mi-tarjeta/", **self.auth(resp.data["sesion"]))["Cache-Control"], "no-store")
        self.assertEqual(self.get("mi-tarjeta/")["Cache-Control"], "no-store")  # también el 401

    def test_la_cache_de_limites_admite_muchos_visitantes(self):
        self.assertGreaterEqual(caches["sorteo_throttle"]._max_entries, 100_000)
