# Iniciar backend, web y Expo juntos

En Windows, abre `INICIAR.cmd` en la carpeta del proyecto. También puedes ejecutar
`node scripts/iniciar-red.mjs` desde una terminal. No hace falta activar el venv:
el iniciador utiliza directamente `backend/.venv/Scripts/python.exe`.

El iniciador detecta la IPv4 del Wi-Fi, actualiza la URL local de la app y los
hosts permitidos del backend. Inicia Django en `0.0.0.0:8001`, Vite en el puerto
3000 y Expo en LAN en el 8081. Comprueba que respondan por la IP de red. El celular
y el equipo deben usar la misma red. Usa el QR nuevo de Expo y recarga la app si
ya estaba abierta (las variables EXPO_PUBLIC quedan incorporadas al bundle).

Los servicios que ya estén funcionando se reutilizan. Si un puerto está ocupado
por un servicio inaccesible desde la red, muestra el problema sin cerrar procesos
ajenos. Deja abierta la ventana que inicia los servicios; Ctrl+C detiene solo los
procesos que esa ejecución haya creado. Los logs están en `tmp/inicio-red/`.

- Diagnóstico sin cambios: `node scripts/iniciar-red.mjs --check`
- Solo backend y web: `node scripts/iniciar-red.mjs --no-expo`
- Elegir una interfaz: `node scripts/iniciar-red.mjs --ip=10.35.1.84`

Si la app dice que no puede conectar, abre en el navegador del celular la URL de
BACKEND que imprime el iniciador. Debe aparecer la lista de provincias. Si no abre,
el problema está entre el celular y la PC (red, aislamiento Wi-Fi o firewall).
Si abre, vuelve a cargar Expo Go usando el QR de la sesión actual.

Este inicio es para desarrollo en la red local. No se ejecuta automáticamente
al encender Windows y no instala servicios ni cambia el firewall.
