"""Configuración del ERP (base portada de TorreSegura, sin su dominio).

Patrón: 12-factor vía django-environ, JWT + sesión para DRF, CORS para el
cliente móvil/web, y SQLite en local (USE_LOCAL_DB=True) o Postgres por
DATABASE_URL en producción.
"""

import mimetypes
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    USE_LOCAL_DB=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="dev-insecure-change-me")
DEBUG = env("DEBUG")

ALLOWED_HOSTS = [
    h for h in env("ALLOWED_HOSTS", default="localhost,127.0.0.1").split(",") if h
]

# --- Apps -------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
]

LOCAL_APPS = [
    "usuarios",
    "empresas",
    "fidelizacion",
    "reportes",
    "entretenimiento",
    "oficinas",
    "pedidos",
    "agente",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "paseo_erp.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "paseo_erp.wsgi.application"
ASGI_APPLICATION = "paseo_erp.asgi.application"

# --- Base de datos ----------------------------------------------------------
USE_LOCAL_DB = env.bool("USE_LOCAL_DB", default=DEBUG)
if USE_LOCAL_DB:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    import dj_database_url

    DATABASES = {
        "default": dj_database_url.config(
            default=env("DATABASE_URL"), conn_max_age=600
        )
    }

AUTH_USER_MODEL = "usuarios.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "usuarios.validators.LetrasYNumerosValidator"},
]

LANGUAGE_CODE = "es"
TIME_ZONE = "America/La_Paz"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "mediafiles"
# Windows no siempre registra .webp (los logos de paseoaranjuez.com): sin esto se sirven como octet-stream.
mimetypes.add_type("image/webp", ".webp")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF / JWT --------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_RATES": {"auth": env("AUTH_THROTTLE_RATE", default="20/min")},
}

from datetime import timedelta  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    # Sesión larga en el celular: el "acceso directo" con huella reutiliza el refresh.
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
}

# --- CORS -------------------------------------------------------------------
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        o for o in env("CORS_ALLOWED_ORIGINS", default="").split(",") if o
    ]
CORS_ALLOW_CREDENTIALS = True

# --- Producción detrás de HTTPS (Caddy/Nginx en el VPS) -------------------------
CSRF_TRUSTED_ORIGINS = [o for o in env("CSRF_TRUSTED_ORIGINS", default="").split(",") if o]
# False si el VPS se usa solo con su IP (http://, sin certificado).
USAR_HTTPS = env.bool("USAR_HTTPS", default=not DEBUG)
if USAR_HTTPS:
    # El proxy termina el HTTPS: así Django arma enlaces https:// (imágenes, QR, correos).
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# --- Correo (credenciales de empresas) ----------------------------------------
# En desarrollo los correos se imprimen en la consola; en producción usar SMTP.
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend"
    if DEBUG
    else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
# Dominios inventados de las cuentas de demo: no se les envía correo real (ver paseo_erp/correo.py).
# En producción, muestra en los logs los códigos de las cuentas de demo (para presentaciones).
CODIGOS_DEMO_EN_LOG = env.bool("CODIGOS_DEMO_EN_LOG", default=False)
EMAIL_DOMINIOS_DEMO = [d.strip().lower() for d in env("EMAIL_DOMINIOS_DEMO", default="paseo.bo").split(",") if d.strip()]
# Si tiene un correo, los mensajes para cuentas de demo se le reenvían (asunto "[Demo: cuenta]").
EMAIL_DEMO_REDIRIGIR = env("EMAIL_DEMO_REDIRIGIR", default="").strip()
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Paseo Aranjuez 360 <no-responder@localhost>")

# --- Enlaces de la plataforma ----------------------------------------------------
# Autorregistro de negocios (rama reto3-paseoya). Apagado: las empresas entran por invitación.
PERMITIR_AUTORREGISTRO_EMPRESAS = env.bool("PERMITIR_AUTORREGISTRO_EMPRESAS", default=False)
WEB_PANEL_URL = env("WEB_PANEL_URL", default="http://localhost:3000")
# Esquema de la app: el QR/NFC de cada empresa abre {APP_DEEP_LINK}/puntos/<codigo>
APP_DEEP_LINK = env("APP_DEEP_LINK", default="paseo360:/")
# URL pública del backend: las invitaciones por WhatsApp enlazan a {PUBLIC_BASE_URL}/invitacion/<código>/
PUBLIC_BASE_URL = env("PUBLIC_BASE_URL", default="http://localhost:8001")

# --- Paseo Points ------------------------------------------------------------------
# Vigencia del QR personal del cliente (la app lo renueva antes de que venza).
QR_CLIENTE_VIGENCIA_SEGUNDOS = env.int("QR_CLIENTE_VIGENCIA_SEGUNDOS", default=120)

# --- Códigos por correo (verificación y doble autenticación) ------------------
CODIGO_VERIFICACION_MINUTOS = env.int("CODIGO_VERIFICACION_MINUTOS", default=10)
CODIGO_VERIFICACION_INTENTOS = env.int("CODIGO_VERIFICACION_INTENTOS", default=5)
