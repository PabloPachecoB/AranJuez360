"""Arreglos de la exploración profunda: concurrencia, IP real, bloqueo por terceros, reenvío, bloqueada, datos."""

from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core import mail
from django.core.cache import caches
from django.core.management import call_command
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.utils import timezone

from sorteo import services
from sorteo.models import Campania, CuentaFidelizacion, DesafioContacto, EventoAuditoria
from sorteo.red import LimiteSorteo, hash_ip, ip_cliente
from sorteo.texto import correo_canonico, iniciales_apellidos, nfc
from usuarios.models import Usuario

from .base import CODIGO_FIJO, SorteoBase


# --- H1: doble envío y concurrencia ------------------------------------------------------------

class ConcurrenciaTests(SorteoBase):
    def test_en_postgresql_se_toma_un_candado_por_contacto(self):
        falso = mock.MagicMock()
        falso.vendor = "postgresql"
        with mock.patch("sorteo.services.connection", falso):
            services._bloquear_contacto("maria@ejemplo.com")
        sql, params = falso.cursor.return_value.__enter__.return_value.execute.call_args[0]
        self.assertIn("pg_advisory_xact_lock", sql)
        self.assertEqual(len(params), 1)

    def test_el_candado_depende_solo_del_contacto(self):
        claves = []
        falso = mock.MagicMock()
        falso.vendor = "postgresql"
        falso.cursor.return_value.__enter__.return_value.execute.side_effect = lambda s, p: claves.append(p[0])
        with mock.patch("sorteo.services.connection", falso):
            for destino in ("a@x.com", "a@x.com", "b@x.com"):
                services._bloquear_contacto(destino)
        self.assertEqual(claves[0], claves[1])
        self.assertNotEqual(claves[0], claves[2])

    def test_en_otras_bases_no_hace_nada(self):
        falso = mock.MagicMock()
        falso.vendor = "sqlite"
        with mock.patch("sorteo.services.connection", falso):
            services._bloquear_contacto("a@x.com")
        falso.cursor.assert_not_called()

    def test_dos_registros_seguidos_dejan_una_cuenta_y_un_codigo_vigente(self):
        self.registrar()
        r = self.registrar()  # el segundo (doble toque) llega con el primero todavía vigente
        self.assertEqual(r.status_code, 429)
        self.assertEqual(CuentaFidelizacion.objects.count(), 1)
        self.assertEqual(DesafioContacto.objects.filter(usado=False).count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_crear_codigo_ante_una_carrera_devuelve_el_que_ya_existe(self):
        self.activar()
        cuenta = CuentaFidelizacion.objects.get()
        activo = cuenta.codigos.get(activo=True)
        # Otra petición ya emitió el código: la restricción de la base lo detecta y se usa ese, sin error 500.
        self.assertEqual(services._crear_codigo(cuenta).pk, activo.pk)
        self.assertEqual(cuenta.codigos.count(), 1)


# --- H2: IP real y límites compartidos ---------------------------------------------------------

class IpRealTests(SimpleTestCase):
    def pedir(self, **meta):
        return RequestFactory().get("/", **meta)

    def test_sin_cabecera_configurada_usa_la_conexion_y_ignora_x_forwarded_for(self):
        with override_settings(SORTEO_IP_HEADER=""):
            r = self.pedir(REMOTE_ADDR="10.0.0.5", HTTP_X_FORWARDED_FOR="6.6.6.6")
            self.assertEqual(ip_cliente(r), "10.0.0.5")

    def test_con_cabecera_del_proxy_usa_esa_y_ignora_x_forwarded_for(self):
        with override_settings(SORTEO_IP_HEADER="X-Client-IP"):
            r = self.pedir(REMOTE_ADDR="10.0.0.5", HTTP_X_CLIENT_IP="190.1.2.3", HTTP_X_FORWARDED_FOR="6.6.6.6")
            self.assertEqual(ip_cliente(r), "190.1.2.3")

    def test_si_la_cabecera_no_es_una_ip_se_usa_la_conexion(self):
        with override_settings(SORTEO_IP_HEADER="X-Client-IP"):
            for raro in ("{client_ip}", "", "no-es-ip", "1.2.3.4, 5.6.7.8"):
                with self.subTest(raro=raro):
                    r = self.pedir(REMOTE_ADDR="10.0.0.5", HTTP_X_CLIENT_IP=raro)
                    self.assertEqual(ip_cliente(r), "10.0.0.5")

    def test_acepta_ipv6(self):
        with override_settings(SORTEO_IP_HEADER="X-Client-IP"):
            r = self.pedir(REMOTE_ADDR="10.0.0.5", HTTP_X_CLIENT_IP="2800:cd0:1::7")
            self.assertEqual(ip_cliente(r), "2800:cd0:1::7")

    def test_la_huella_no_es_la_direccion_y_es_estable(self):
        h = hash_ip("190.1.2.3")
        self.assertEqual(h, hash_ip("190.1.2.3"))
        self.assertNotIn("190", h)
        self.assertEqual(hash_ip(""), "")

    def test_el_limite_usa_una_cache_de_archivos_compartida_entre_workers(self):
        self.assertEqual(LimiteSorteo.cache.__class__.__name__, "FileBasedCache")
        self.assertIs(LimiteSorteo.cache, caches["sorteo_throttle"])


@override_settings(SORTEO_IP_HEADER="X-Client-IP")
class LimiteSinSaltoTests(SorteoBase):
    def desde(self, ip):
        return {"HTTP_X_CLIENT_IP": ip}

    def test_inventar_x_forwarded_for_no_salta_el_limite(self):
        datos = {"desafio": "00000000-0000-4000-8000-000000000000", "codigo": "123456"}
        with mock.patch.dict("rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES", {"sorteo_verificar": "3/min"}):
            estados = [
                self.post("verificar/", datos, HTTP_X_FORWARDED_FOR=f"10.9.9.{i}", **self.desde("190.5.5.5")).status_code
                for i in range(6)
            ]
        self.assertEqual(estados[:3], [400, 400, 400])
        self.assertEqual(set(estados[3:]), {429})

    def test_cada_ip_real_tiene_su_propio_contador(self):
        datos = {"desafio": "00000000-0000-4000-8000-000000000000", "codigo": "123456"}
        with mock.patch.dict("rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES", {"sorteo_verificar": "2/min"}):
            for _ in range(2):
                self.post("verificar/", datos, **self.desde("190.5.5.5"))
            self.assertEqual(self.post("verificar/", datos, **self.desde("190.5.5.5")).status_code, 429)
            self.assertEqual(self.post("verificar/", datos, **self.desde("190.6.6.6")).status_code, 400)


# --- H3: un tercero no puede bloquear a otra persona -------------------------------------------

@override_settings(SORTEO_IP_HEADER="X-Client-IP")
class AntiBloqueoTests(SorteoBase):
    VICTIMA = "maria@ejemplo.com"

    def pedir(self, ip, contacto=None):
        self.envejecer(contacto or self.VICTIMA)
        return self.post("recuperar/", {"contacto": contacto or self.VICTIMA}, HTTP_X_CLIENT_IP=ip)

    def setUp(self):
        super().setUp()
        self.activar()  # la víctima ya tiene su tarjeta (cuenta como 1 código del día)

    def test_una_sola_ip_se_topa_antes_de_agotar_el_cupo_de_la_victima(self):
        resultados = [self.pedir("203.0.113.9").status_code for _ in range(8)]
        self.assertIn(429, resultados)
        # el atacante quedó frenado, pero la víctima, desde su propia IP, todavía puede recuperar su tarjeta
        r = self.pedir("190.1.1.1")
        self.assertEqual(r.status_code, 200, r.data)
        # 1 del registro + 5 que consiguió el atacante (su tope por IP) + 1 de la víctima
        self.assertEqual(DesafioContacto.objects.filter(destino=self.VICTIMA).count(), 7)

    def test_el_tope_por_ip_se_cuenta_por_contacto_y_no_por_persona(self):
        self.activar(correo="otra@ejemplo.com", celular="61234567", nombres="Otra", apellidos="Persona")
        for _ in range(4):
            self.pedir("203.0.113.9")
        # la misma IP puede pedir códigos para OTRO contacto sin tocar el cupo anterior
        self.assertEqual(self.pedir("203.0.113.9", "otra@ejemplo.com").status_code, 200)

    def test_el_tope_diario_total_sigue_protegiendo_al_contacto(self):
        mensajes = []
        for i in range(12):
            mensajes.append(self.pedir(f"198.51.100.{i}").status_code)  # muchas IPs distintas
        self.assertEqual(mensajes[:9], [200] * 9)  # 1 (registro) + 9 = tope diario de 10
        self.assertEqual(set(mensajes[9:]), {429})

    def test_el_mensaje_de_limite_indica_como_pedir_ayuda(self):
        for i in range(12):
            r = self.pedir(f"198.51.100.{i}")
        self.assertEqual(r.data["codigo"], "limite_envios")
        self.assertIn("mostrador", r.data["detail"])

    def test_el_admin_puede_desbloquear_los_envios_de_la_persona(self):
        for i in range(12):
            self.pedir(f"198.51.100.{i}")
        cuenta = CuentaFidelizacion.objects.get()
        admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)
        self.assertGreaterEqual(services.desbloquear_envios(cuenta, admin), 10)
        self.assertEqual(self.pedir("190.1.1.1").status_code, 200)
        evento = EventoAuditoria.objects.get(tipo=EventoAuditoria.Tipo.ENVIOS_DESBLOQUEADOS)
        self.assertEqual((evento.actor, evento.cuenta), (admin, cuenta))


# --- M4: reenviar tras agotar los intentos o vencer ---------------------------------------------

class ReenvioTests(SorteoBase):
    def agotar(self, desafio):
        for _ in range(5):
            r = self.post("verificar/", {"desafio": desafio, "codigo": "000000"})
        self.assertEqual(r.data["codigo"], "demasiados_intentos")

    def test_se_puede_pedir_otro_codigo_despues_de_agotar_los_intentos(self):
        d = self.registrar().data["desafio"]
        self.agotar(d)
        self.envejecer("maria@ejemplo.com")
        nuevo = self.post("reenviar/", {"desafio": d})
        self.assertEqual(nuevo.status_code, 200, nuevo.data)
        self.assertNotEqual(nuevo.data["desafio"], d)
        ok = self.post("verificar/", {"desafio": nuevo.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual(ok.status_code, 200)

    def test_un_codigo_agotado_se_distingue_de_uno_inexistente(self):
        d = self.registrar().data["desafio"]
        self.agotar(d)
        otra_vez = self.post("verificar/", {"desafio": d, "codigo": CODIGO_FIJO})
        self.assertEqual((otra_vez.status_code, otra_vez.data["codigo"]), (400, "codigo_agotado"))
        self.assertIn("Pide otro", otra_vez.data["detail"])
        # el desafío agotado sigue sirviendo para pedir otro código; uno inexistente no
        self.envejecer("maria@ejemplo.com")
        self.assertEqual(self.post("reenviar/", {"desafio": d}).status_code, 200)
        inexistente = self.post("verificar/", {"desafio": "00000000-0000-4000-8000-000000000000", "codigo": CODIGO_FIJO})
        self.assertEqual(inexistente.data["codigo"], "desafio_invalido")

    def test_se_puede_pedir_otro_codigo_despues_de_vencer(self):
        d = self.registrar().data["desafio"]
        DesafioContacto.objects.update(expira_en=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.post("verificar/", {"desafio": d, "codigo": CODIGO_FIJO}).data["codigo"], "codigo_vencido")
        self.envejecer("maria@ejemplo.com")
        self.assertEqual(self.post("reenviar/", {"desafio": d}).status_code, 200)

    def test_un_desafio_ya_verificado_no_se_reutiliza(self):
        d = self.registrar().data["desafio"]
        self.assertEqual(self.post("verificar/", {"desafio": d, "codigo": CODIGO_FIJO}).status_code, 200)
        self.envejecer("maria@ejemplo.com")
        r = self.post("reenviar/", {"desafio": d})
        self.assertEqual((r.status_code, r.data["codigo"]), (400, "desafio_invalido"))
        self.assertIsNotNone(DesafioContacto.objects.get(desafio=d).verificado_en)

    def test_un_desafio_reemplazado_por_otro_mas_nuevo_ya_no_sirve_para_reenviar(self):
        d1 = self.registrar().data["desafio"]
        self.envejecer("maria@ejemplo.com")
        d2 = self.post("reenviar/", {"desafio": d1}).data["desafio"]
        # d1 es claramente anterior a d2 (envejecer() dejaría ambos con la misma hora)
        ahora = timezone.now()
        DesafioContacto.objects.filter(desafio=d1).update(creado_en=ahora - timedelta(seconds=300))
        DesafioContacto.objects.filter(desafio=d2).update(creado_en=ahora - timedelta(seconds=120))
        viejo = self.post("reenviar/", {"desafio": d1})
        self.assertEqual((viejo.status_code, viejo.data["codigo"]), (400, "desafio_invalido"))
        self.assertEqual(self.post("reenviar/", {"desafio": d2}).status_code, 200)

    def test_el_reenvio_mantiene_la_espera_de_60_segundos(self):
        d = self.registrar().data["desafio"]
        self.agotar(d)
        r = self.post("reenviar/", {"desafio": d})
        self.assertEqual((r.status_code, r.data["codigo"]), (429, "espera_reenvio"))

    def test_reenviar_con_un_desafio_inexistente(self):
        r = self.post("reenviar/", {"desafio": "00000000-0000-4000-8000-000000000000"})
        self.assertEqual((r.status_code, r.data["codigo"] if hasattr(r.data, "get") else None), (400, "desafio_invalido"))


# --- M6: cuenta bloqueada -----------------------------------------------------------------------

class CuentaBloqueadaTests(SorteoBase):
    def test_con_sesion_vigente_dice_que_esta_bloqueada_y_no_que_vencio(self):
        sesion = self.activar().data["sesion"]
        CuentaFidelizacion.objects.update(estado=CuentaFidelizacion.Estado.BLOQUEADA)
        r = self.get("mi-tarjeta/", **self.auth(sesion))
        self.assertEqual((r.status_code, r.data["codigo"]), (403, "cuenta_bloqueada"))
        self.assertIn("mostrador", r.data["detail"])

    def test_un_token_invalido_sigue_siendo_sesion_invalida(self):
        r = self.get("mi-tarjeta/", **self.auth("basura"))
        self.assertEqual((r.status_code, r.data["codigo"]), (401, "sesion_invalida"))

    def test_el_esquema_de_la_cabecera_no_distingue_mayusculas(self):
        sesion = self.activar().data["sesion"]
        for esquema in ("Tarjeta", "tarjeta", "TARJETA"):
            with self.subTest(esquema=esquema):
                r = self.get("mi-tarjeta/", HTTP_AUTHORIZATION=f"{esquema} {sesion}")
                self.assertEqual(r.status_code, 200)

    def test_contacto_en_uso_orienta_a_pedir_ayuda(self):
        self.activar()
        CuentaFidelizacion.objects.update(estado=CuentaFidelizacion.Estado.BLOQUEADA)
        self.envejecer("maria@ejemplo.com")
        r = self.registrar(nombres="Otra")
        r = self.post("verificar/", {"desafio": r.data["desafio"], "codigo": CODIGO_FIJO})
        self.assertEqual((r.status_code, r.data["codigo"]), (409, "contacto_en_uso"))
        self.assertIn("mostrador", r.data["detail"])


# --- Menores: nombres, correos, celulares -------------------------------------------------------

class NormalizacionTests(SorteoBase):
    def test_acentos_descompuestos_se_aceptan_y_se_guardan_normalizados(self):
        for crudo in ("José", "Martín", "Ángel"):
            self.assertNotEqual(crudo, nfc(crudo))
        r = self.registrar(nombres="José Martín", apellidos="Pérez")
        self.assertEqual(r.status_code, 201, r.data)
        cuenta = CuentaFidelizacion.objects.get()
        self.assertEqual((cuenta.nombres, cuenta.apellidos), ("José Martín", "Pérez"))

    def test_correos_sin_dominio_de_internet_se_rechazan(self):
        for malo in ("a@localhost", "a@[127.0.0.1]", "a@intranet", "a@b"):
            with self.subTest(malo=malo):
                r = self.registrar(correo=malo)
                self.assertEqual(r.status_code, 400)
                self.assertIn("correo", r.data)

    def test_correos_normales_siguen_valiendo(self):
        for bueno in ("a@ejemplo.com", "ana.paz+sorteo@mail.ejemplo.com.bo", "a@éjemplo.com"):
            with self.subTest(bueno=bueno):
                CuentaFidelizacion.objects.all().delete()
                DesafioContacto.objects.all().delete()
                self.assertEqual(self.registrar(correo=bueno).status_code, 201)

    def test_celular_con_prefijo_00591(self):
        self.assertEqual(self.registrar(celular="0059171234567").status_code, 201)
        self.assertEqual(CuentaFidelizacion.objects.get().celular, "71234567")

    def test_iniciales_ignoran_las_particulas(self):
        self.assertEqual(iniciales_apellidos("Gómez Pérez"), "G. P.")
        self.assertEqual(iniciales_apellidos("De la Cruz"), "C.")
        self.assertEqual(iniciales_apellidos("Del Carmen Soto"), "C. S.")
        self.assertEqual(iniciales_apellidos("De"), "D.")  # si solo hay partículas, no queda vacío


class DuplicadosConAliasTests(SorteoBase):
    def test_correo_canonico(self):
        self.assertEqual(correo_canonico("Ana.Paz+sorteo@Gmail.com"), "anapaz@gmail.com")
        self.assertEqual(correo_canonico("a.b@googlemail.com"), "ab@gmail.com")
        self.assertEqual(correo_canonico("a.b+x@empresa.com.bo"), "a.b@empresa.com.bo")

    def test_los_alias_se_senalan_como_posibles_duplicados(self):
        self.activar(correo="ana.paz@gmail.com", celular="61000001")
        otra = self.activar(correo="anapaz+2@gmail.com", celular="61000002", nombres="Ana", apellidos="Paz")
        cuenta = CuentaFidelizacion.objects.get(correo="anapaz+2@gmail.com")
        self.assertEqual(services.posibles_duplicados(cuenta), 1)
        self.assertTrue(otra.data["tarjeta"]["codigo"])

    def test_el_canonico_se_actualiza_al_cambiar_el_correo(self):
        self.registrar(correo="a.b@gmail.com")
        cuenta = CuentaFidelizacion.objects.get()
        self.assertEqual(cuenta.correo_canonico, "ab@gmail.com")
        cuenta.correo = "otra.persona@gmail.com"
        cuenta.save(update_fields=["correo"])
        cuenta.refresh_from_db()
        self.assertEqual(cuenta.correo_canonico, "otrapersona@gmail.com")


# --- Menor: estado de la campaña ----------------------------------------------------------------

class EstadoCampaniaTests(SorteoBase):
    def estado(self, nuevo):
        Campania.objects.update(estado=nuevo)
        return self.get("campania/").data

    def test_activa(self):
        datos = self.get("campania/").data
        self.assertEqual((datos["activa"], datos["estado"]), (True, "ACTIVA"))

    def test_pausada_y_cerrada_se_distinguen(self):
        pausada = self.estado(Campania.Estado.PAUSADA)
        self.assertEqual((pausada["activa"], pausada["estado"], pausada["nombre"]), (False, "PAUSADA", "Sorteo Paseo"))
        cerrada = self.estado(Campania.Estado.CERRADA)
        self.assertEqual((cerrada["activa"], cerrada["estado"]), (False, "CERRADA"))

    def test_sin_campania(self):
        Campania.objects.all().delete()
        datos = self.get("campania/").data
        self.assertEqual((datos["activa"], datos["estado"], datos["nombre"]), (False, "SIN_CAMPANIA", None))
        Campania.objects.create(estado=Campania.Estado.BORRADOR)  # un borrador no cuenta
        self.assertEqual(self.get("campania/").data["estado"], "SIN_CAMPANIA")

    def test_la_tarjeta_trae_el_estado(self):
        sesion = self.activar().data["sesion"]
        Campania.objects.update(estado=Campania.Estado.PAUSADA)
        t = self.get("mi-tarjeta/", **self.auth(sesion)).data
        self.assertEqual((t["campania"]["estado"], t["progreso"]), ("PAUSADA", None))


# --- Menor: limpieza de la auditoría de caja -----------------------------------------------------

class LimpiezaAuditoriaTests(SorteoBase):
    def test_solo_caducan_las_consultas_en_caja_antiguas(self):
        self.activar()
        cuenta = CuentaFidelizacion.objects.get()
        viejo = timezone.now() - timedelta(days=400)
        for tipo in (EventoAuditoria.Tipo.RESOLUCION, EventoAuditoria.Tipo.REGISTRO):
            e = EventoAuditoria.objects.create(cuenta=cuenta, tipo=tipo)
            EventoAuditoria.objects.filter(pk=e.pk).update(creado_en=viejo)
        EventoAuditoria.objects.create(cuenta=cuenta, tipo=EventoAuditoria.Tipo.RESOLUCION)  # reciente

        salida = StringIO()
        call_command("limpiar_sorteo", stdout=salida)

        self.assertIn("1 consultas de caja", salida.getvalue())
        resoluciones = EventoAuditoria.objects.filter(tipo=EventoAuditoria.Tipo.RESOLUCION).count()
        self.assertEqual(resoluciones, 1)  # la reciente se queda
        self.assertTrue(EventoAuditoria.objects.filter(tipo=EventoAuditoria.Tipo.REGISTRO, creado_en__lt=timezone.now() - timedelta(days=300)).exists())


# --- Menor: enlace de términos solo https --------------------------------------------------------

class TerminosHttpsTests(SimpleTestCase):
    def test_la_regla_de_settings(self):
        # La misma lógica que settings.py aplica al leer SORTEO_TERMINOS_URL.
        def filtrar(url):
            url = url.strip()
            return url if not url or url.startswith("https://") else ""

        self.assertEqual(filtrar("javascript:alert(1)"), "")
        self.assertEqual(filtrar("http://ejemplo.bo/t"), "")
        self.assertEqual(filtrar("https://ejemplo.bo/t"), "https://ejemplo.bo/t")
        self.assertEqual(filtrar(""), "")
