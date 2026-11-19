# Sorteo Paseo — Wallet Android

Mi parte del módulo nuevo de fidelización (issue #42 "Completar Google Wallet en
Android" del tablero del equipo): registro público y la tarjeta de puntos que se
guarda en Google Wallet.

## Estado actual

- `RegistroPage.tsx` y `MiTarjetaPage.tsx` están construidas con **datos
  simulados** (`datosSimulados.ts`) porque todavía no existe ningún endpoint
  HTTP que conecte esto con `backend/fidelizacion/wallet_google.py` — ver
  `docs/FIDELIZACION_EQUIPO.md`.
- El botón "Agregar a Google Wallet" está deshabilitado a propósito: el enlace
  real lo tiene que firmar el backend (`enlace_guardar` / `enlace_guardar_existente`
  en `wallet_google.py`), que necesita la clave de cuenta de servicio de Google
  (hoy solo la tiene Pablo, fuera del repo).

## Rutas públicas (sin sesión)

- `/fidelizacion/registro` — alta de la tarjeta.
- `/fidelizacion/mi-tarjeta/:codigo` — puntos, participaciones y progreso.

## Qué falta para conectar con el backend real

1. Que exista un endpoint `POST` de registro y uno `GET` que resuelva un
   código a su `EstadoTarjeta` (mismos campos que el dataclass en
   `wallet_google.py`: `codigo`, `puntos`, `participaciones`, `faltan_bs`,
   `pendientes`, `fecha_sorteo`, `primer_nombre`).
2. Reemplazar `datosSimulados.ts` por llamadas con `api()` de `src/api/client.ts`.
3. Que el backend exponga el enlace real de "Agregar a Google Wallet" (firmado
   con la clave de servicio) para habilitar el botón.
4. Probar todo en un Android físico — Wallet no se comporta bien en emulador.
