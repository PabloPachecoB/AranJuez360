# Sorteo Paseo — Wallet Android

Mi parte del módulo nuevo de fidelización (issue #42 "Completar Google Wallet en
Android" del tablero del equipo): registro público y la tarjeta de puntos que se
guarda en Google Wallet.

## Estado actual

- `RegistroPage.tsx` muestra un código fijo de ejemplo al "crear" la cuenta —
  todavía no existe el endpoint de registro real (es tarea de "Backend
  compartido de fidelización", sin asignar). Ver `docs/FIDELIZACION_EQUIPO.md`.
- `MiTarjetaPage.tsx` muestra **puntos y participaciones simulados**
  (`datosSimulados.ts`) por la misma razón — falta el backend de compras.
- El botón **"Agregar a Google Wallet" sí es real**: llama a
  `POST /api/v1/sorteo-paseo/wallet/publicar/` (nuevo, en
  `backend/fidelizacion/wallet_android_views.py`), que publica el pase en la
  cuenta real de Google Wallet y devuelve el enlace de guardado. Ese endpoint
  es un puente mínimo — no guarda nada en base de datos, solo conecta el botón
  con la cuenta real (criterio de aceptación de la issue #42).

## Rutas públicas (sin sesión)

- `/fidelizacion/registro` — alta de la tarjeta.
- `/fidelizacion/mi-tarjeta/:codigo` — puntos, participaciones y progreso.

## Qué falta para conectar del todo con el backend real

1. Que exista un endpoint de registro y uno que resuelva un código a su
   `EstadoTarjeta` real (mismos campos que el dataclass en `wallet_google.py`:
   `codigo`, `puntos`, `participaciones`, `faltan_bs`, `pendientes`,
   `fecha_sorteo`, `primer_nombre`) — tarea de "Backend compartido de
   fidelización".
2. Reemplazar `datosSimulados.ts` por esas llamadas reales (el publicado a
   Wallet, en `api.ts`, ya es real).
3. Probar todo en un Android físico — Wallet no se comporta bien en emulador.
4. **Importante:** cuando el punto 1 exista, `wallet_android_views.py` debe
   dejar de confiar en los puntos/participaciones que manda el cliente y leer
   el estado real de la cuenta en el servidor (el cliente solo pasaría el
   código). Ahora mismo el endpoint es público y confía en esos montos —
   aceptable solo porque todavía no hay cuentas ni compras reales detrás; ver
   la advertencia en el docstring de ese archivo.

## Configuración local para probar el publicado real

`backend/.env` necesita (clave JSON fuera del repo, nunca en git):
```
GOOGLE_WALLET_ISSUER_ID=...
GOOGLE_WALLET_KEY_PATH=/ruta/a/upilot-wallet.json
GOOGLE_WALLET_LOGO_URL=https://.../logo-360-sello-wallet.png
GOOGLE_WALLET_LOGO_ANCHO_URL=https://.../logo-360-ancho-wallet.png
```
Mientras no haya VPS con dominio (tarea aparte), sirve una URL temporal de
`raw.githubusercontent.com` para los logos.
