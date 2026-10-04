# Despliegue en un VPS

Se sube al servidor el **backend** (API, Jarvis, monedas, oficinas), el **panel web**
(admin, mini-sistema de cada empresa, `/sitio/…`, `/activar/…`) y las **invitaciones con QR**.
La **app sigue en Expo** (Expo Go) y solo cambia a qué servidor se conecta.

```
Internet ──HTTPS──▶ Caddy (web) ──▶ /api, /auth, /admin, /invitacion ──▶ backend (gunicorn) ──▶ PostgreSQL
                         └──▶ panel web (React), /static, /media
```

Caddy saca y renueva el certificado HTTPS solo (Let's Encrypt).

## 1. Lo que hace falta

- Un **VPS con Ubuntu 22.04 o 24.04**, 2 GB de RAM como mínimo, con los puertos 80 y 443 abiertos.
- Un **dominio** (ej. `paseo360.com`). En el panel del dominio, crea un registro **A** que apunte a la IP del VPS.
  Espera a que propague (`ping paseo360.com` debe responder con la IP del VPS).

### ¿Sin dominio? Usa la IP del VPS

No hace falta comprar dominio. Con la IP del VPS (ej. `203.0.113.5`) hay dos opciones en `deploy/.env`:

| Opción | `DOMINIO` | `USAR_HTTPS` | Las URL (`WEB_PANEL_URL`, `PUBLIC_BASE_URL`, `CSRF_TRUSTED_ORIGINS`) |
|---|---|---|---|
| **HTTPS gratis con sslip.io** (recomendada) | `203-0-113-5.sslip.io` | `True` | `https://203-0-113-5.sslip.io` |
| Solo IP, sin candado (pruebas) | `http://203.0.113.5` | `False` | `http://203.0.113.5` |

En `ALLOWED_HOSTS` va el nombre **sin** `http(s)://` (`203-0-113-5.sslip.io` o `203.0.113.5`).
`sslip.io` es un servicio gratuito que hace que `IP-con-guiones.sslip.io` apunte a esa IP; así Caddy puede
sacar un certificado HTTPS real. En la app: `EXPO_PUBLIC_API_BASE=https://203-0-113-5.sslip.io` (o `http://IP`).

## 2. Preparar el VPS (una sola vez)

```bash
ssh root@IP_DEL_VPS
curl -fsSL https://get.docker.com | sh          # instala Docker y Docker Compose
git clone https://github.com/PabloPachecoB/AranJuez360.git
cd AranJuez360/deploy
cp .env.example .env
nano .env                                         # completa dominio, claves y contraseñas
```

En `.env`:

- `DOMINIO`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `WEB_PANEL_URL`, `PUBLIC_BASE_URL`: tu dominio.
- `SECRET_KEY`: genera una con `python3 -c "import secrets; print(secrets.token_urlsafe(50))"`.
- `POSTGRES_PASSWORD`: una clave larga.
- Correo de Gmail (contraseña de aplicación), Qwen y ElevenLabs: las mismas claves de `backend/.env` local.

## 3. Levantar todo

```bash
docker compose up -d --build                      # la primera vez tarda unos minutos
docker compose exec backend python manage.py cargar_demo        # datos de demo (opcional)
docker compose exec backend python manage.py crear_admin tu-correo@gmail.com   # tu cuenta de admin real
```

Abre `https://paseo360.com`: el panel web ya funciona desde cualquier red.

> Usa tu admin real con un correo verdadero (el código de verificación te llega por correo).
> Las cuentas de demo (`@paseo.bo`) tienen la contraseña pública `Paseo2026!`: no las uses en producción
> o desactívalas desde el panel una vez que tengas tu admin.
>
> **Para una presentación con las cuentas de demo:** pon `CODIGOS_DEMO_EN_LOG=True` en `.env`,
> reinicia (`docker compose up -d`) y mira los códigos con `docker compose logs -f backend`.

## 4. Actualizar cuando haya cambios

```bash
cd AranJuez360 && git pull
cd deploy && docker compose up -d --build         # migra la base sola al arrancar
```

## 5. La app (sigue en Expo)

En tu PC, cambia `app/.env` para que la app use el servidor:

```
EXPO_PUBLIC_API_BASE=https://paseo360.com
```

Luego:

- **En tu red Wi-Fi:** `npx expo start --lan --clear` (como siempre).
- **Para gente en otras redes** (jurados, empresas, otras ciudades): `npx expo start --tunnel --clear`.
  Expo da un QR que funciona desde cualquier red con **Expo Go** instalado. Tu PC tiene que
  estar encendida mientras lo usan (la PC entrega la app; los datos vienen del VPS).

## Comandos útiles

```bash
docker compose ps                                  # estado de los servicios
docker compose logs -f backend                     # ver errores del backend
docker compose exec backend python manage.py shell
docker compose down                                # apagar (los datos quedan en los volúmenes)
```

## Respaldos

- Base de datos: `docker compose exec db pg_dump -U paseo360 paseo360 > respaldo.sql`
- Imágenes subidas: viven en el volumen `media` (`docker run --rm -v deploy_media:/m -v $PWD:/b alpine tar czf /b/media.tgz -C /m .`).
