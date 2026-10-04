---
tags: [tecnico, despliegue]
estado: recomendación (no implementado)
---

# Despliegue en VPS

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
