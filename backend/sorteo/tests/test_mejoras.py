"""Casos hallados en la exploración: límites, fallo de envío, nombres, rastro de caja, sesión y limpieza."""

from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core import mail
from django.core.management import call_command
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.throttling import ScopedRateThrottle

from empresas.models import Empresa
from sorteo import services
from sorteo.models import CuentaFidelizacion, DesafioContacto, EventoAuditoria
from sorteo.texto import capitalizar_nombre
from usuarios.models import Usuario

from .base import CODIGO_FIJO, SorteoBase


class LimitesTests(SorteoBase):
    def test_la_pagina_de_campania_no_tiene_limite(self):
        # La carga cada visitante y el Wi-Fi del Paseo comparte una sola IP.
        for _ in range(80):
            self.assertEqual(self.get("campania/").status_code, 200)

    def test_el_aviso_de_limite_es_en_espanol_y_con_codigo(self):
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"sorteo_verificar": "2/min"}):
            datos = {"desafio": "00000000-0000-4000-8000-000000000000", "codigo": "123456"}
            for _ in range(2):
                self.assertEqual(self.post("verificar/", datos).status_code, 400)
            r = self.post("verificar/", datos)
        self.assertEqual((r.status_code, r.data["codigo"]), (429, "demasiadas_peticiones"))
        self.assertIn("Prueba en", r.data["detail"])
        self.assertNotIn("throttled", r.data["detail"].lower())

    def test_verificar_y_enviar_tienen_limites_separados(self):
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"sorteo_verificar": "1/min"}):
            datos = {"desafio": "00000000-0000-4000-8000-000000000000", "codigo": "123456"}
            self.post("verificar/", datos)
            self.assertEqual(self.post("verificar/", datos).status_code, 429)
            self.assertEqual(self.registrar().status_code, 201)  # registrarse sigue disponible


class EnvioFallidoTests(SorteoBase):
    def test_si_el_correo_falla_avisa_y_no_deja_nada_a_medias(self):
        with mock.patch("sorteo.canales.send_mail", side_effect=OSError("smtp caído")), self.assertLogs("sorteo.canales", "ERROR"):
            r = self.registrar()
        self.assertEqual((r.status_code, r.data["codigo"]), (503, "envio_fallido"))
        self.assertNotIn("smtp", r.data["detail"].lower())
        self.assertEqual(CuentaFidelizacion.objects.count(), 0)
        self.assertEqual(DesafioContacto.objects.count(), 0)
        # puede reintentar enseguida: el intento fallido no cuenta para la espera ni para el tope diario
        self.assertEqual(self.registrar().status_code, 201)
        self.assertEqual(len(mail.outbox), 1)

    def test_si_falla_al_recuperar_tambien_avisa(self):
        self.activar()
        self.envejecer("maria@ejemplo.com")
        with mock.patch("sorteo.canales.send_mail", side_effect=OSError("x")), self.assertLogs("sorteo.canales", "ERROR"):
            r = self.post("recuperar/", {"contacto": "maria@ejemplo.com"})
        self.assertEqual((r.status_code, r.data["codigo"]), (503, "envio_fallido"))


class NombresTests(SorteoBase):
    def test_rechaza_html_emojis_y_numeros(self):
        for malo in ("<script>alert(1)</script>", "😀😀", "Ana123", "Ana_María", "Ana;DROP", "-Ana", "Ana  -"):
            with self.subTest(malo=malo):
                r = self.registrar(nombres=malo)
                self.assertEqual(r.status_code, 400, r.data)
                self.assertIn("solo letras", str(r.data["nombres"][0]))
        self.assertEqual(CuentaFidelizacion.objects.count(), 0)

    def test_acepta_tildes_guiones_y_apostrofos(self):
        self.assertEqual(self.registrar(nombres="José-Luis", apellidos="O'Brien Ñáñez").status_code, 201)
        cuenta = CuentaFidelizacion.objects.get()
        self.assertEqual((cuenta.nombres, cuenta.apellidos), ("José-Luis", "O'Brien Ñáñez"))

    def test_ordena_las_mayusculas(self):
        self.registrar(nombres="luis alberto", apellidos="DE LA CRUZ")
        cuenta = CuentaFidelizacion.objects.get()
        self.assertEqual((cuenta.nombres, cuenta.apellidos), ("Luis Alberto", "De la Cruz"))
        self.assertEqual(cuenta.nombre_reducido, "Luis C.")  # las partículas «de», «la» no cuentan como inicial

    def test_mensajes_en_espanol_de_tu(self):
        r = self.registrar(nombres="A", apellidos="")
        self.assertEqual(str(r.data["nombres"][0]), "Escribe al menos 2 letras.")
        self.assertEqual(str(r.data["apellidos"][0]), "Completa este campo.")
        r = self.post("verificar/", {"desafio": "no-uuid", "codigo": "123456"})
        self.assertEqual(str(r.data["desafio"][0]), "El código ya no es válido. Empieza de nuevo.")


class CapitalizarTests(SimpleTestCase):
    def test_casos(self):
        casos = {
            "luis alberto": "Luis Alberto", "MARÍA JOSÉ": "María José", "maría del carmen": "María del Carmen",
            "ana-lucía": "Ana-Lucía", "McDonald": "McDonald", "María José": "María José", "de la cruz": "De la Cruz",
            "o'brien": "O'Brien", "D'ANGELO": "D'Angelo", "o’connor": "O’Connor", "juan carlos": "Juan Carlos",
        }
        for entrada, esperado in casos.items():
            with self.subTest(entrada=entrada):
                self.assertEqual(capitalizar_nombre(entrada), esperado)


class RastroDeCajaTests(SorteoBase):
    def setUp(self):
        super().setUp()
        self.activar()
        self.cuenta = CuentaFidelizacion.objects.get()
        self.codigo = self.cuenta.codigos.get(activo=True).codigo
        self.empresa = Empresa.objects.create(nombre="Café X", email_contacto="cafe@x.com")
        self.cajero = Usuario.objects.create_user("caja", password="x", rol=Usuario.Rol.CAJERO, empresa=self.empresa)
        self.client.force_authenticate(self.cajero)

    def test_cada_consulta_queda_registrada_con_quien_la_hizo(self):
        self.assertEqual(self.get(f"resolver/{self.codigo}/").status_code, 200)
        evento = EventoAuditoria.objects.get(tipo=EventoAuditoria.Tipo.RESOLUCION)
        self.assertEqual((evento.cuenta, evento.actor, evento.detalle), (self.cuenta, self.cajero, f"empresa={self.empresa.pk}"))

    def test_un_codigo_invalido_no_registra_consulta_pero_avisa_en_el_log(self):
        with self.assertLogs("sorteo.views", "WARNING"):
            self.assertEqual(self.get("resolver/PA-AAAAAA/").status_code, 404)
        self.assertFalse(EventoAuditoria.objects.filter(tipo=EventoAuditoria.Tipo.RESOLUCION).exists())

    def test_limite_por_usuario_de_caja(self):
        otro = Usuario.objects.create_user("caja2", password="x", rol=Usuario.Rol.CAJERO, empresa=self.empresa)
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"sorteo_resolver": "2/min"}), \
                self.assertLogs("sorteo.views", "WARNING"):
            for _ in range(2):
                self.get("resolver/PA-AAAAAA/")
            r = self.get("resolver/PA-AAAAAA/")
            self.assertEqual((r.status_code, r.data["codigo"]), (429, "demasiadas_peticiones"))
            self.client.force_authenticate(otro)  # el límite es por usuario, no por IP
            self.assertEqual(self.get(f"resolver/{self.codigo}/").status_code, 200)


class CerrarSesionTests(SorteoBase):
    def test_cerrar_sesion_invalida_el_token_en_el_servidor(self):
        sesion = self.activar().data["sesion"]
        self.assertEqual(self.post("mi-tarjeta/cerrar-sesion/", **self.auth(sesion)).status_code, 204)
        r = self.get("mi-tarjeta/", **self.auth(sesion))
        self.assertEqual((r.status_code, r.data["codigo"]), (401, "sesion_invalida"))
        self.assertTrue(EventoAuditoria.objects.filter(tipo=EventoAuditoria.Tipo.SESION_CERRADA).exists())

    def test_no_afecta_a_otras_cuentas_y_exige_sesion(self):
        una = self.activar().data["sesion"]
        otra = self.activar(correo="otra@ejemplo.com", celular="61234567").data["sesion"]
        self.post("mi-tarjeta/cerrar-sesion/", **self.auth(una))
        self.assertEqual(self.get("mi-tarjeta/", **self.auth(otra)).status_code, 200)
        self.assertEqual(self.post("mi-tarjeta/cerrar-sesion/").status_code, 401)

    def test_tras_cerrar_se_puede_volver_a_entrar_recuperando(self):
        resp = self.activar()
        self.post("mi-tarjeta/cerrar-sesion/", **self.auth(resp.data["sesion"]))
        self.envejecer("maria@ejemplo.com")
        r = self.post("recuperar/", {"contacto": "maria@ejemplo.com"})
        ok = self.post("verificar/", {"desafio": r.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(ok.data["tarjeta"]["codigo"], resp.data["tarjeta"]["codigo"])


class DuplicadosTests(SorteoBase):
    def test_se_senalan_las_cuentas_que_comparten_un_contacto(self):
        self.activar()
        maria = CuentaFidelizacion.objects.get()
        self.assertEqual(services.posibles_duplicados(maria), 0)
        # otra cuenta con el mismo celular (sin verificar) y otro correo: se permite, pero queda señalada
        self.activar(correo="maria2@ejemplo.com", nombres="María", apellidos="Dos")
        self.assertEqual(services.posibles_duplicados(maria), 1)

        admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)
        self.client.force_authenticate(admin)
        codigo = maria.codigos.get(activo=True).codigo
        self.assertEqual(self.get(f"resolver/{codigo}/").data["posibles_duplicados"], 1)


class TerminosTests(SorteoBase):
    def test_enlace_de_terminos_solo_si_esta_configurado(self):
        self.assertIsNone(self.get("campania/").data["terminos_url"])
        with override_settings(SORTEO_TERMINOS_URL="https://paseoaranjuez.com/sorteo/terminos"):
            self.assertEqual(self.get("campania/").data["terminos_url"], "https://paseoaranjuez.com/sorteo/terminos")


class LimpiezaTests(SorteoBase):
    def test_borra_lo_viejo_y_conserva_lo_verificado_y_lo_reciente(self):
        self.activar()                                               # verificada
        self.registrar(correo="vieja@ejemplo.com", celular="61111111")    # pendiente vieja
        self.registrar(correo="nueva@ejemplo.com", celular="62222222")    # pendiente reciente
        hace = timezone.now() - timedelta(days=10)
        CuentaFidelizacion.objects.filter(correo="vieja@ejemplo.com").update(creada_en=hace)
        DesafioContacto.objects.exclude(destino="nueva@ejemplo.com").update(creado_en=hace)

        salida = StringIO()
        call_command("limpiar_sorteo", stdout=salida)

        self.assertEqual(set(CuentaFidelizacion.objects.values_list("correo", flat=True)),
                         {"maria@ejemplo.com", "nueva@ejemplo.com"})
        self.assertEqual(list(DesafioContacto.objects.values_list("destino", flat=True)), ["nueva@ejemplo.com"])
        self.assertIn("1 cuentas sin verificar", salida.getvalue())
        # la cuenta verificada conserva su tarjeta
        self.assertEqual(CuentaFidelizacion.objects.get(correo="maria@ejemplo.com").codigos.filter(activo=True).count(), 1)

    def test_nunca_borra_los_desafios_de_las_ultimas_24_horas(self):
        self.registrar()
        self.assertEqual(services.limpiar(dias_desafios=0, dias_pendientes=0, dias_auditoria=0), (0, 0, 0))
        self.assertEqual(DesafioContacto.objects.count(), 1)
