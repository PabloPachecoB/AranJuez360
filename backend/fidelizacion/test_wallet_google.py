import json
import tempfile
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.test import SimpleTestCase

from .wallet_google import (
    URL_GUARDAR,
    ClienteWallet,
    EstadoTarjeta,
    WalletErrorAPI,
    WalletNoConfigurado,
    cargar_config,
    clase_lealtad,
    enlace_guardar,
    enlace_guardar_existente,
    objeto_lealtad,
)

ESTADO = EstadoTarjeta(codigo="PA-TEST01", puntos=6, participaciones=6, faltan_bs=70,
                       pendientes=2, fecha_sorteo="20 dic")


class _Resp:
    def __init__(self, status, datos=None):
        self.status_code, self._datos, self.text = status, datos or {}, json.dumps(datos or {})

    def json(self):
        return self._datos


class _SesionFalsa:
    """Imita a Google: guarda recursos en memoria y anota las llamadas."""

    def __init__(self):
        self.recursos, self.llamadas = {}, []

    def post(self, url, json=None, data=None, headers=None, timeout=None):
        self.llamadas.append(("POST", url))
        if url.endswith("/token"):
            return _Resp(200, {"access_token": "tok", "expires_in": 3600})
        self.recursos[json["id"]] = json
        return _Resp(200, json)

    def get(self, url, headers=None, timeout=None):
        self.llamadas.append(("GET", url))
        id_ = url.rsplit("/", 1)[1]
        return _Resp(200, self.recursos[id_]) if id_ in self.recursos else _Resp(404)

    def put(self, url, json=None, headers=None, timeout=None):
        self.llamadas.append(("PUT", url))
        self.recursos[json["id"]] = json
        return _Resp(200, json)


class WalletGoogleTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        llave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.publica = llave.public_key()
        pem = llave.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                  serialization.NoEncryption()).decode()
        cls.dir = tempfile.TemporaryDirectory()
        cls.ruta = Path(cls.dir.name) / "llave.json"
        cls.ruta.write_text(json.dumps({"client_email": "prueba@proyecto.iam.gserviceaccount.com",
                                        "private_key": pem}), encoding="utf-8")
        cls.entorno = {"GOOGLE_WALLET_ISSUER_ID": "3388000000000000000",
                       "GOOGLE_WALLET_KEY_PATH": str(cls.ruta),
                       "GOOGLE_WALLET_LOGO_URL": "https://ejemplo.bo/logo.png",
                       "GOOGLE_WALLET_HERO_URL": "https://ejemplo.bo/banner.jpg",
                       "GOOGLE_WALLET_SITIO_URL": "https://ejemplo.bo"}

    @classmethod
    def tearDownClass(cls):
        cls.dir.cleanup()
        super().tearDownClass()

    def cfg(self, **extra):
        return cargar_config({**self.entorno, **extra})

    def decodificar(self, enlace):
        self.assertTrue(enlace.startswith(URL_GUARDAR))
        return jwt.decode(enlace[len(URL_GUARDAR):], self.publica, algorithms=["RS256"], audience="google")

    # --- configuración ---
    def test_faltan_variables(self):
        with self.assertRaisesMessage(WalletNoConfigurado, "GOOGLE_WALLET_ISSUER_ID"):
            cargar_config({})

    def test_urls_deben_ser_https(self):
        for var in ("GOOGLE_WALLET_LOGO_URL", "GOOGLE_WALLET_HERO_URL", "GOOGLE_WALLET_SITIO_URL"):
            with self.subTest(var=var), self.assertRaises(WalletNoConfigurado):
                self.cfg(**{var: "http://ejemplo.bo/x"})

    def test_llave_inexistente(self):
        with self.assertRaises(WalletNoConfigurado):
            self.cfg(GOOGLE_WALLET_KEY_PATH=str(self.ruta) + ".no")

    # --- contenido de la tarjeta ---
    def test_frente_muestra_faltan_pendientes_y_sorteo(self):
        filas = clase_lealtad(self.cfg())["classTemplateInfo"]["cardTemplateOverride"]["cardRowTemplateInfos"]
        ruta = lambda item: item["firstValue"]["fields"][0]["fieldPath"]  # noqa: E731
        self.assertEqual([ruta(filas[0]["twoItems"][k]) for k in ("startItem", "endItem")],
                         ["object.textModulesData['puntos']", "object.textModulesData['participaciones']"])
        self.assertEqual([ruta(filas[1]["threeItems"][k]) for k in ("startItem", "middleItem", "endItem")],
                         ["object.textModulesData['faltan']", "object.textModulesData['pendientes']",
                          "object.textModulesData['sorteo']"])
        textos = {m["id"]: m["body"] for m in objeto_lealtad(self.cfg(), ESTADO)["textModulesData"]}
        self.assertEqual({k: textos[k] for k in ("puntos", "participaciones", "faltan", "pendientes", "sorteo")},
                         {"puntos": "6", "participaciones": "6", "faltan": "Bs 70",
                          "pendientes": "2 compras", "sorteo": "20 dic"})

    def test_banner_y_enlaces_opcionales(self):
        clase = clase_lealtad(self.cfg())
        self.assertEqual(clase["heroImage"]["sourceUri"]["uri"], "https://ejemplo.bo/banner.jpg")
        self.assertEqual(clase["linksModuleData"]["uris"][0]["uri"], "https://ejemplo.bo")
        minima = clase_lealtad(self.cfg(GOOGLE_WALLET_HERO_URL="", GOOGLE_WALLET_SITIO_URL=""))
        self.assertNotIn("heroImage", minima)
        self.assertNotIn("linksModuleData", minima)
        self.assertNotIn("wideProgramLogo", minima)
        ancho = clase_lealtad(self.cfg(GOOGLE_WALLET_LOGO_ANCHO_URL="https://ejemplo.bo/ancho.png"))
        self.assertEqual(ancho["wideProgramLogo"]["sourceUri"]["uri"], "https://ejemplo.bo/ancho.png")

    def test_nombre_solo_si_se_da_y_solo_el_primero(self):
        self.assertNotIn("accountName", objeto_lealtad(self.cfg(), ESTADO))
        con_nombre = EstadoTarjeta(**{**ESTADO.__dict__, "primer_nombre": "María José"})
        self.assertEqual(objeto_lealtad(self.cfg(), con_nombre)["accountName"], "María")

    def test_singular_de_pendientes(self):
        una = EstadoTarjeta(**{**ESTADO.__dict__, "pendientes": 1})
        textos = {m["id"]: m["body"] for m in objeto_lealtad(self.cfg(), una)["textModulesData"]}
        self.assertEqual(textos["pendientes"], "1 compra")

    def test_pase_sin_datos_de_contacto(self):
        pase = json.dumps(objeto_lealtad(self.cfg(), ESTADO)).lower()
        for prohibido in ("@", "celular", "telefono", "email", "correo"):
            self.assertNotIn(prohibido, pase)

    def test_codigo_invalido(self):
        with self.assertRaises(ValueError):
            objeto_lealtad(self.cfg(), EstadoTarjeta("PA 1/2", 0, 0, 200, 0, "-"))

    # --- enlaces firmados ---
    def test_enlace_completo_firmado(self):
        datos = self.decodificar(enlace_guardar(self.cfg(), ESTADO, ahora=1_700_000_000))
        self.assertEqual(datos["typ"], "savetowallet")
        clase, pase = datos["payload"]["loyaltyClasses"][0], datos["payload"]["loyaltyObjects"][0]
        self.assertEqual(clase["issuerName"], "Paseo Aranjuez")
        self.assertEqual(pase["classId"], clase["id"])
        self.assertEqual(pase["barcode"], {"type": "QR_CODE", "value": "PA-TEST01", "alternateText": "PA-TEST01"})

    def test_enlace_corto_solo_referencia_el_pase(self):
        datos = self.decodificar(enlace_guardar_existente(self.cfg(), "PA-TEST01"))
        self.assertEqual(datos["payload"], {"loyaltyObjects": [
            {"id": "3388000000000000000.PA-TEST01", "classId": "3388000000000000000.paseo_sorteo"}]})

    # --- API de Google ---
    def test_publicar_crea_y_luego_actualiza(self):
        sesion = _SesionFalsa()
        cliente = ClienteWallet(self.cfg(), sesion)
        cliente.publicar_clase()
        cliente.publicar_pase(ESTADO)
        self.assertIn(("POST", "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject"),
                      sesion.llamadas)
        cliente.publicar_pase(EstadoTarjeta(**{**ESTADO.__dict__, "puntos": 7}))
        self.assertEqual(sesion.llamadas[-1][0], "PUT")
        pase = sesion.recursos["3388000000000000000.PA-TEST01"]
        self.assertEqual(pase["loyaltyPoints"]["balance"]["int"], 7)
        # el token se pide una sola vez
        self.assertEqual(sum(1 for m, u in sesion.llamadas if u.endswith("/token")), 1)

    def test_error_de_google(self):
        sesion = _SesionFalsa()
        sesion.post = lambda url, **k: _Resp(200, {"access_token": "t"}) if url.endswith("/token") \
            else _Resp(400, {"error": "mal"})
        with self.assertRaises(WalletErrorAPI):
            ClienteWallet(self.cfg(), sesion).publicar_pase(ESTADO)


class BannerProgresoTests(SimpleTestCase):
    def test_tamano_recomendado_por_google(self):
        from io import BytesIO

        from PIL import Image

        from .wallet_banner import ALTO, ANCHO, generar_banner
        img = Image.open(BytesIO(generar_banner(6, 70, fecha_sorteo="20 dic")))
        self.assertEqual((img.format, img.size), ("PNG", (ANCHO, ALTO)))

    def test_casos_borde_no_fallan(self):
        from .wallet_banner import generar_banner
        for puntos, faltan in ((0, 200), (1, 0), (120, 1), (3, 999)):
            with self.subTest(puntos=puntos, faltan=faltan):
                self.assertTrue(generar_banner(puntos, faltan).startswith(b"\x89PNG"))

    def test_monto_por_punto_invalido(self):
        from .wallet_banner import generar_banner
        with self.assertRaises(ValueError):
            generar_banner(1, 10, monto_por_punto=0)
