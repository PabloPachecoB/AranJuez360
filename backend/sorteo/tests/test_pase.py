from unittest import mock

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import SimpleTestCase
from requests import Timeout

from fidelizacion.wallet_google import EstadoTarjeta, ConfigWallet, WalletErrorAPI, WalletNoConfigurado, objeto_lealtad
from sorteo import pase, services
from sorteo.models import Campania, CuentaFidelizacion, EventoAuditoria, PaseWallet
from usuarios.models import Usuario

from .base import SorteoBase

_LLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_PEM = _LLAVE.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                            serialization.NoEncryption()).decode()
CFG = ConfigWallet(issuer_id="3388000000000000000", email_cuenta="x@y.iam.gserviceaccount.com",
                   llave_privada=_PEM, logo_url="https://ejemplo.bo/logo.png")


class _ClienteFalso:
    """Imita a ClienteWallet: anota qué se publicó."""

    instancias = []

    def __init__(self, cfg, sesion=None):
        self.clase, self.pases = 0, []
        type(self).instancias.append(self)

    def publicar_clase(self):
        self.clase += 1

    def publicar_pase(self, estado):
        if _ClienteFalso.fallar:
            raise WalletErrorAPI("Google rechazó el pase (400)")
        self.pases.append(estado)
        _ClienteFalso.publicados.append(estado)


def _preparar():
    _ClienteFalso.instancias, _ClienteFalso.publicados, _ClienteFalso.fallar = [], [], False


class PaseGoogleTests(SorteoBase):
    def setUp(self):
        super().setUp()
        _preparar()
        for destino, valor in (("sorteo.pase.cargar_config", CFG), ("sorteo.pase.ClienteWallet", _ClienteFalso)):
            parche = mock.patch(destino, **({"return_value": valor} if destino.endswith("config") else {"new": valor}))
            parche.start()
            self.addCleanup(parche.stop)
        resp = self.activar()
        self.sesion = resp.data["sesion"]
        self.cuenta = CuentaFidelizacion.objects.get()

    def google(self):
        return self.post("mi-tarjeta/google-wallet/", **self.auth(self.sesion))

    def test_publica_y_devuelve_el_enlace_para_guardar(self):
        resp = self.google()
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["estado"], "SINCRONIZADO")
        self.assertTrue(resp.data["url"].startswith("https://pay.google.com/gp/v/save/"))
        registro = PaseWallet.objects.get()
        self.assertEqual((registro.plataforma, registro.estado_sync), ("GOOGLE", "SINCRONIZADO"))
        self.assertTrue(registro.pase_id.startswith("pw-"))
        self.assertIsNotNone(registro.sincronizado_en)
        self.assertTrue(EventoAuditoria.objects.filter(tipo="WALLET_PUBLICADO").exists())

    def test_el_pase_lleva_el_estado_de_la_cuenta_sin_datos_de_contacto(self):
        self.google()
        estado = _ClienteFalso.publicados[0]
        self.assertEqual(estado.codigo, self.cuenta.codigos.get(activo=True).codigo)
        self.assertEqual((estado.puntos, estado.faltan_bs, estado.fecha_sorteo, estado.primer_nombre),
                         (0, 200, "20 dic", "María"))
        import json
        cuerpo = json.dumps(objeto_lealtad(CFG, estado)).lower()
        for prohibido in ("@", "ejemplo.com", "71234567", "gómez"):
            self.assertNotIn(prohibido, cuerpo)

    def test_la_clase_se_publica_solo_con_el_primer_pase(self):
        self.google()
        self.google()
        self.assertEqual([c.clase for c in _ClienteFalso.instancias], [1, 0])
        self.assertEqual(PaseWallet.objects.count(), 1)  # el mismo pase se actualiza, no se duplica

    def test_reintenta_la_clase_tras_un_corte_de_red_en_la_primera_emision(self):
        with mock.patch.object(_ClienteFalso, "publicar_clase", side_effect=Timeout):
            respuesta = self.google()
        self.assertEqual((respuesta.status_code, respuesta.data["codigo"]), (503, "wallet_error"))
        registro = PaseWallet.objects.get()
        self.assertEqual(registro.estado_sync, PaseWallet.Sync.ERROR)
        self.assertEqual(_ClienteFalso.publicados, [])

        self.assertEqual(self.google().status_code, 200)
        self.assertEqual(_ClienteFalso.instancias[-1].clase, 1)
        self.assertEqual(_ClienteFalso.publicados[-1].pase_id, registro.pase_id)
        registro.refresh_from_db()
        self.assertEqual((registro.estado_sync, registro.intentos), (PaseWallet.Sync.SINCRONIZADO, 2))

    def test_revocar_conserva_el_pase_id_y_cambia_solo_el_qr(self):
        self.google()
        pase_id = PaseWallet.objects.get().pase_id
        viejo = _ClienteFalso.publicados[0].codigo
        admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)
        nuevo = services.revocar_codigo(self.cuenta.pk, admin, "prueba")
        self.assertEqual(PaseWallet.objects.get().estado_sync, PaseWallet.Sync.PENDIENTE)

        pase.resincronizar_si_existe(self.cuenta)
        ultimo = _ClienteFalso.publicados[-1]
        self.assertEqual((ultimo.pase_id, ultimo.codigo), (pase_id, nuevo.codigo))
        self.assertNotEqual(ultimo.codigo, viejo)
        self.assertEqual(PaseWallet.objects.get().estado_sync, PaseWallet.Sync.SINCRONIZADO)
        self.assertEqual(PaseWallet.objects.count(), 1)

    def test_si_google_falla_la_cuenta_no_se_ve_afectada(self):
        _ClienteFalso.fallar = True
        resp = self.google()
        self.assertEqual((resp.status_code, resp.data["codigo"]), (503, "wallet_error"))
        registro = PaseWallet.objects.get()
        self.assertEqual(registro.estado_sync, PaseWallet.Sync.ERROR)
        self.assertIn("400", registro.ultimo_error)
        self.assertEqual(registro.intentos, 1)
        # la tarjeta y la sesión siguen funcionando
        self.assertEqual(self.get("mi-tarjeta/", **self.auth(self.sesion)).status_code, 200)
        self.assertEqual(self.get("mi-tarjeta/", **self.auth(self.sesion)).data["pases"]["google"], "ERROR")
        # y se puede reintentar
        _ClienteFalso.fallar = False
        self.assertEqual(self.google().status_code, 200)
        self.assertEqual(PaseWallet.objects.get().estado_sync, PaseWallet.Sync.SINCRONIZADO)

    def test_fallar_al_actualizar_tras_revocar_no_impide_la_revocacion(self):
        self.google()
        _ClienteFalso.fallar = True
        admin = Usuario.objects.create_user("admin", password="x", rol=Usuario.Rol.ADMIN)
        self.client.force_authenticate(admin)
        r = self.client.post(f"{self.URL}admin/cuentas/{self.cuenta.pk}/revocar-codigo/", {"motivo": "prueba"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(PaseWallet.objects.get().estado_sync, PaseWallet.Sync.ERROR)

    def test_sin_campania_activa(self):
        Campania.objects.update(estado=Campania.Estado.CERRADA)
        resp = self.google()
        self.assertEqual((resp.status_code, resp.data["codigo"]), (409, "campania_inactiva"))
        self.assertEqual(PaseWallet.objects.count(), 0)

    def test_wallet_sin_configurar(self):
        with mock.patch("sorteo.pase.cargar_config", side_effect=WalletNoConfigurado("faltan variables")):
            resp = self.google()
        self.assertEqual((resp.status_code, resp.data["codigo"]), (503, "wallet_no_configurado"))
        self.assertNotIn("variables", str(resp.data))  # no se filtran detalles de la configuración

    def test_apple_aun_no_esta_disponible(self):
        resp = self.post("mi-tarjeta/apple-wallet/", **self.auth(self.sesion))
        self.assertEqual((resp.status_code, resp.data["codigo"]), (501, "apple_pendiente"))
        self.assertEqual(self.get("mi-tarjeta/", **self.auth(self.sesion)).data["pases"]["apple"], "NO_DISPONIBLE")

    def test_hay_que_tener_sesion(self):
        resp = self.post("mi-tarjeta/google-wallet/")
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(_ClienteFalso.instancias, [])


class FechaYEstadoTests(SimpleTestCase):
    def test_fecha_corta(self):
        from datetime import date
        self.assertEqual(pase.fecha_corta(date(2026, 12, 20)), "20 dic")
        self.assertEqual(pase.fecha_corta(date(2026, 3, 1)), "1 mar")
        self.assertEqual(pase.fecha_corta(None), "Por anunciar")

    def test_el_pase_id_separa_el_pase_del_qr(self):
        estado = EstadoTarjeta("PA-AAAAAA", 0, 0, 200, 0, "-", pase_id="pw-abc")
        self.assertEqual(objeto_lealtad(CFG, estado)["id"], "3388000000000000000.pw-abc")
        self.assertEqual(objeto_lealtad(CFG, estado)["barcode"]["value"], "PA-AAAAAA")
        sin = EstadoTarjeta("PA-AAAAAA", 0, 0, 200, 0, "-")
        self.assertEqual(objeto_lealtad(CFG, sin)["id"], "3388000000000000000.PA-AAAAAA")  # pases de prueba intactos
