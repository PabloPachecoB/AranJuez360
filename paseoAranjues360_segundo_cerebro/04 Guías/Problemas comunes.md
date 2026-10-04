---
tags: [guia, troubleshooting]
---

# Problemas comunes

## "¿Dónde está el código de verificación?"
En la **terminal del backend** (los correos se imprimen ahí en desarrollo):
```
To: cliente@paseo.bo
Usa este código para terminar de iniciar sesión:
    123456
```
- Usa siempre el **último** y revisa que el `To:` sea la cuenta con la que entras.
- Pedir otro código invalida el anterior. 5 intentos, vence en 10 min.

## Puertos
| Puerto | Situación |
|---|---|
| 8000 | Ocupado por otro proyecto Django (Python 3.10, parece TorreSegura) → usamos **8001** |
| 5173 | Reservado por Windows (rango Hyper-V 5141–5240) → web en **3000** |
| 8081 | Ocupado por otro proceso de Node → app en **8082** |
Ver rangos reservados: `netsh interface ipv4 show excludedportrange protocol=tcp`

"Port already in use" → ya hay otra copia corriendo; ciérrala con Ctrl + C.

## Pantalla en blanco en la app
1. Recarga con **Ctrl + Shift + R**.
2. En la terminal de Expo pulsa **r** (recargar). El error aparece en esa terminal.
3. **No** arrancar Expo con `CI=1`: en ese modo no vigila archivos y sirve código viejo.

## La web muestra datos de otro proyecto / 404 raros
El proxy de Vite debe apuntar a `http://127.0.0.1:8001` (`web/vite.config.ts`). Si apunta al 8000, responde el otro proyecto.

## El celular no conecta (o cambió la IP de la PC)
Si cambias de red: actualizar la IP en `app/.env` y `backend/.env` (`ALLOWED_HOSTS`, `WEB_PANEL_URL`, `PUBLIC_BASE_URL`), reiniciar el backend y abrir Expo con `npx expo start -c` (las `EXPO_PUBLIC_*` quedan dentro del paquete).
- Mismo Wi-Fi que la PC.
- `app/.env` con la IP de la PC: `EXPO_PUBLIC_API_BASE=http://192.168.0.11:8001`
- `ALLOWED_HOSTS` en `backend/.env` debe incluir esa IP.
- Aceptar el aviso del firewall de Windows para Python y Node.

## El monedero dice "solo para cuentas de cliente"
Estás con la cuenta de admin en la app; entra con `cliente@paseo.bo`.

## No se ven las fotos de los negocios en la app
1. Recargar Expo (**r**) o `npx expo start -c`: el teléfono puede tener la versión anterior.
2. Las URLs de las imágenes usan el host con el que la app llama al backend (`EXPO_PUBLIC_API_BASE`); el backend debe servir `/media/` (`DEBUG=True` en local).
3. Logos `.webp`: en Windows hay que registrar el tipo (`mimetypes.add_type("image/webp", ".webp")` en `settings.py`), si no salen como `octet-stream`.
4. Solo 12 tiendas tienen portada y galería; las demás muestran logo. → [[Directorio y rubros]]
5. En Expo web, un `ScrollView` horizontal dentro de una columna puede colapsar: usar `style={{ flexGrow: 0 }}`.
