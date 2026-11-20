---
tags: [tecnico, despliegue]
estado: desplegado (versión del 2026-10-04)
actualizado: 2026-10-18
---

# Despliegue en VPS

## ✅ Estado actual (revisado 2026-10-18)
| Dato | Valor |
|---|---|
| IP del VPS | `179.236.240.61` |
| URL | https://179-236-240-61.sslip.io (HTTPS gratis con sslip.io; `http://IP` redirige ahí) |
| Qué corre | Panel web + API (Docker Compose de `deploy/`, Caddy + gunicorn + PostgreSQL) |
| Versión | Commit `ffaf9e6` / `5c0c4dc` (build web del **2026-10-04 14:14 UTC**) |
| App | Sigue en Expo; para usar el VPS: `EXPO_PUBLIC_API_BASE=https://179-236-240-61.sslip.io` en `app/.env` |

**Cómo se comprobó:** la web responde con "Paseo Aranjuez 360 — Panel"; existen las rutas de Escenario abierto, asistente de análisis y recepción (`ffaf9e6`), pero **no** `api/v1/agente/conversaciones/` (Jarvis con historial, rama `deploy/vps-setup` de Jhoestar).

**Lo que falta subir:** los 11 commits de `origin/deploy/vps-setup` (Jhoestar, 16–18 oct): conversaciones guardadas de Jarvis, títulos automáticos, texto a voz, teclado en Android y Caddy compartido (`docker-compose.proxy.yml`). Primero unirlos a `integracion-equipo`, después en el VPS:
```bash
cd AranJuez360 && git pull
cd deploy && docker compose up -d --build   # migra solo al arrancar
```
Ojo: con el Caddy compartido de Jhoestar cambia la forma de levantarlo; revisar `deploy/README.md` de su rama antes de actualizar.

## Acceso SSH (comprobado 2026-10-18)
| Dato | Valor |
|---|---|
| Comando | `ssh root@179.236.240.61` |
| Usuario | `root` (hostname `srv2031932`, Ubuntu 24.04.5 LTS) |
| Autenticación | Llave `~/.ssh/id_ed25519` de la PC de Pablo (llave por defecto, no necesita entrada en `~/.ssh/config`) |

> La contraseña de root (si existe) **no** se guarda aquí; queda en el panel del proveedor del VPS.

## Diseño original (recomendación)

## Base de datos: PostgreSQL
SQLite sirve para desarrollar. En producción **PostgreSQL es obligatorio**: varios porteros y cajas escribiendo a la vez, bloqueo por fila (`select_for_update`) para no duplicar puntos, reportes rápidos y respaldos en caliente.
El backend ya está listo: `psycopg` instalado y `DATABASE_URL` en `.env` (con `USE_LOCAL_DB=False`).

## Arquitectura propuesta
```
VPS (Docker Compose)
├─ Caddy / Nginx  → HTTPS automático
│   ├─ /             → web (build estático)
│   ├─ /api, /auth   → Django + Gunicorn
│   └─ /media        → logos y fotos
├─ Django (Gunicorn 3–4 workers)
├─ PostgreSQL (volumen)
└─ Redis (caché y límites de intentos)
Correos → Brevo / Resend / Amazon SES
Respaldos → pg_dump diario fuera del VPS
```

| Pieza | Elección |
|---|---|
| VPS | 2 vCPU / 4 GB (Hetzner, DigitalOcean, Contabo), Ubuntu 24.04 |
| Dominio | `paseo360.bo` (web) y `api.paseo360.bo` |
| HTTPS | Caddy (automático) |
| Correo | Servicio transaccional (no Gmail) |
| Imágenes | Volumen; luego Cloudflare R2 / S3 |
| CI/CD | GitHub Actions: pruebas + despliegue al unir a `main` |

## La app no va al VPS
Se compila con **EAS Build** (APK/AAB e iOS) apuntando a `https://api.paseo360.bo`. Con build real funcionan NFC, huella y el deep link `paseo360://`.

## Ajustes al código antes de producción
1. DEBUG=False, SECRET_KEY, ALLOWED_HOSTS, CORS.
2. Redis como caché.
3. Envío de correos en segundo plano.
4. Estáticos y media servidos por Caddy/Nginx.

Ver [[Seguridad]] · [[Pendientes]]
