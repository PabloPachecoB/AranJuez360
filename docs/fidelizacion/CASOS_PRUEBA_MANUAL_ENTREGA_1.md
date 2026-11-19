# Casos de prueba manual · Entrega 1 (registro público y cuenta de fidelización)

Para quien pruebe a mano la tarea «[Wallet] Implementar registro público y cuenta de fidelización».
Contrato y reglas: [`PLAN_ENTREGA_1_REGISTRO_Y_CUENTA.md`](./PLAN_ENTREGA_1_REGISTRO_Y_CUENTA.md).

## Preparación

1. Backend (desde `backend/`, con el entorno virtual y `DEBUG=True` en `.env`):

   ```bash
   python manage.py migrate
   python manage.py cargar_demo
   python manage.py crear_campania_sorteo --fecha-sorteo 2026-12-20 --lanzar
   python manage.py runserver 0.0.0.0:8001
   ```

2. Web (desde `web/`): `npx vite` y abrir `http://localhost:3000/tarjeta`.
3. Probar en el celular o con la vista de celular del navegador (375 px): la página se abre desde un QR.

**Dónde sale el código de verificación.** En la terminal del backend:
`===== CÓDIGO DEL SORTEO para maria@ejemplo.com: 123456 =====` (por celular: `CÓDIGO DEL SORTEO (celular 71234567)`).
Usa siempre el último.

**Cuentas de panel** (contraseña `Paseo2026!`; su código de acceso también sale en la terminal):
`admin@paseo.bo` (admin), `caja.cafe@paseo.bo` (cajero), `cafearanjuez@paseo.bo` (negocio), `cliente@paseo.bo`,
`portero@paseo.bo`, `estudiolegalandino@paseo.bo` (oficina). Admin de Django: `http://localhost:8001/admin`.

**Topes que afectan a quien prueba.** Entre un código y otro para el mismo contacto hay que esperar 60 s. Cada
contacto admite 10 códigos por día y 5 desde la misma IP. Si aparece «Pediste muchos códigos hoy», usa otro
correo o desbloquea la cuenta (caso ADM-07).

**Para empezar de cero en el navegador:** «Cerrar sesión» en la tarjeta, o borrar los datos del sitio.

Datos sugeridos: María José Gómez Pérez, `maria@ejemplo.com`, `71234567`.

## 1. Registro

| ID | Pasos | Resultado esperado |
|---|---|---|
| REG-01 | Abrir `/tarjeta` | Título «Tu tarjeta del Sorteo Paseo» y debajo «Cada Bs 200 en compras = 1 punto para el sorteo.». La pestaña dice «Sorteo Paseo · Paseo Aranjuez 360» |
| REG-02 | Completar los cinco datos, elegir «A mi correo», aceptar términos y pulsar «Crear mi tarjeta» | Pasa a «Escribe tu código» con el correo enmascarado (`m••••@ejemplo.com`) y «Vale 10 minutos». En la terminal aparece un solo código |
| REG-03 | Pulsar «Crear mi tarjeta» con todo vacío | No avanza. Bajo cada campo: «Completa este campo.», «Escribe tu correo.», «Escribe tu celular.» y «Debes aceptar los términos y condiciones.» |
| REG-04 | Nombres `Ana123`, luego `<b>Ana</b>`, luego `😀` | «Usa solo letras.» |
| REG-05 | Nombres `A` | «Escribe al menos 2 letras.» |
| REG-06 | Correo `foo`, luego `juan@`, luego `a@localhost` | «Correo incompleto.» al salir del campo o al enviar |
| REG-21 | Correo `ju an@gmail.com` | «Revisa tu correo.» |
| REG-07 | Celular `51234567`; luego `7123456`; luego `11` | «El celular empieza con 6 o 7.»; «Celular incompleto.»; «Celular incompleto.» |
| REG-22 | En el celular, escribir `aa` y luego `7a1b` | Las letras no se escriben: el campo queda vacío y luego `71`. Con Bolivia no deja pasar de 8 dígitos |
| REG-08 | País: bandera de Bolivia (+591), celular `71234567`; en otro registro, escribir `+591 712-34567` | Se acepta. En el admin la cuenta queda con `71234567` |
| REG-17 | País: bandera de Argentina (+54), celular `9 11 2345-6789`, «A mi celular» | La ayuda bajo el campo dice «Tu número, sin el código de país.». Llega a «Lo enviamos a tu celular +54••••••89». En el admin: `+5491123456789` |
| REG-18 | País: «Otro» (ícono del mundo), celular `+44 7911 123456` | Se acepta y se guarda `+447911123456` |
| REG-19 | País: «Otro» (ícono del mundo), celular `3001234567` (sin código) | «Agrega el código de tu país. Ej.: +44» |
| REG-20 | Tras REG-17, cerrar sesión y entrar por la pestaña «Celular» con la bandera de Argentina y `9 11 2345 6789` | Llega el código y se abre la misma tarjeta |
| REG-09 | Nombres `luis alberto`, apellidos `DE LA CRUZ`; completar la verificación | La tarjeta saluda «Hola, Luis». En el admin: «Luis Alberto» y «De la Cruz» |
| REG-10 | Nombres `José-Luis`, apellidos `O'Brien Ñáñez` | Se acepta tal cual |
| REG-11 | Elegir «A mi celular» y registrar | «Lo enviamos a tu celular ••••••67». El código sale en la terminal como «(celular …)» |
| REG-12 | Tocar «Crear mi tarjeta» dos o tres veces muy rápido | Una sola pantalla de verificación, un solo código en la terminal y una sola cuenta en el admin |
| REG-13 | Registrar, volver con «Cambiar mis datos» y registrar de inmediato con el mismo correo | Mensaje «Espera N segundos para pedir otro código.» |
| REG-14 | Con una tarjeta ya verificada, cerrar sesión y registrar otra vez con ese mismo correo (envío «A mi correo») y otros nombres | No avanza: «Ya tienes una tarjeta con ese correo. Entra a tu tarjeta.» con el enlace «Entrar». No sale ningún código en la terminal ni se crea otra cuenta. Lo mismo con el celular si ese fue el dato confirmado |
| REG-15 | Con la sesión abierta, abrir `/tarjeta` | Lleva directo a «Mi tarjeta» |
| REG-16 | Abrir `/Tarjeta` (con mayúscula) y `/tarjeta/cualquier-cosa` | Ambas muestran el registro |

## 2. Verificación del código

| ID | Pasos | Resultado esperado |
|---|---|---|
| VER-01 | Escribir el código correcto | Al sexto dígito entra solo a la tarjeta, sin pulsar «Verificar» |
| VER-02 | Escribir un código incorrecto | «Código incorrecto. Te quedan 4 intento(s).». Las casillas se vacían y el cursor vuelve a la primera (en el celular el teclado sigue abierto) |
| VER-03 | Fallar cinco veces | Al quinto: «Demasiados intentos. Pide un código nuevo.» |
| VER-04 | Tras VER-03, intentar una sexta vez con el código correcto | «Este código ya no sirve. Pide otro.» |
| VER-05 | Tras VER-03, esperar a que el botón diga «Pedir otro código» y pulsarlo | «Te enviamos otro código.». El código nuevo de la terminal permite entrar |
| VER-06 | Mirar el botón de reenvío recién llegado | «Pedir otro código en 59 s», bajando cada segundo; deshabilitado hasta llegar a 0 |
| VER-07 | Recargar la página durante la cuenta regresiva | Sigue en la verificación y el contador continúa (no vuelve a 60) |
| VER-08 | Reenviar y luego usar el código **anterior** | No entra. Solo sirve el último código |
| VER-09 | Esperar más de 10 minutos y escribir el código | «El código venció. Pide uno nuevo.». «Pedir otro código» funciona |
| VER-10 | Pegar el código completo en la primera casilla | Se reparte en las seis y verifica |
| VER-11 | Escribir letras; escribir 3 dígitos y tocar la última casilla | Las letras se ignoran. El cursor salta a la primera casilla vacía (la cuarta) |
| VER-12 | Borrar con retroceso | Borra de derecha a izquierda, sin huecos |
| VER-13 | Abrir `/tarjeta/verificar` sin haber registrado nada | Lleva al registro |
| VER-14 | Pulsar «Cambiar mis datos» | Vuelve al registro con el formulario vacío |

## 3. Mi tarjeta

| ID | Pasos | Resultado esperado |
|---|---|---|
| TAR-01 | Entrar tras verificar | «Hola, María», nombre de la campaña, «Tus puntos» 0 con el texto «Cada punto es una oportunidad de ganar.», barra vacía, «Bs 0 / Bs 200», «Faltan Bs 200», «Sorteo: 20 de diciembre» |
| TAR-02 | Mirar el código | QR y debajo el mismo código en texto, con forma `PA-` + 6 caracteres (sin 0, O, 1, I ni L) |
| TAR-03 | Escanear el QR con la cámara de otro celular | Se lee exactamente el texto `PA-…` que se ve debajo |
| TAR-04 | Recargar la página y cerrar y abrir el navegador | Sigue en la tarjeta, con el mismo código |
| TAR-05 | Registrar con un primer nombre muy largo sin espacios (40 letras) | El saludo se parte en varias líneas; la página no se desplaza hacia los lados |
| TAR-06 | Abrir `/tarjeta/mi` sin sesión | Lleva a «Entra a tu tarjeta» |

## 4. Recuperación y sesión

| ID | Pasos | Resultado esperado |
|---|---|---|
| REC-01 | En otro navegador (o ventana privada), «¿Ya tienes tarjeta? Entrar» con el correo verificado | Llega un código. Al escribirlo se ve la **misma** tarjeta (mismo `PA-…`) |
| REC-02 | Tras REC-01, volver al primer navegador y recargar | Lleva a «Entra a tu tarjeta» con el aviso «Tu sesión se cerró. Pide un código para entrar.» |
| REC-03 | Entrar con un correo válido que no tiene tarjeta (`nadie@ejemplo.com`); luego, en «Celular», con `78945631` | No avanza: «Correo inválido.» / «Celular inválido.». Debajo sigue «¿No tienes tarjeta? Crear una». No sale ningún código en la terminal |
| REC-04 | Tarjeta confirmada por correo: entrar por la pestaña «Celular» con su celular | «Celular inválido.» (el celular no se confirmó). No llega código |
| REC-05 | Tarjeta verificada por celular: pestaña «Celular», bandera de Bolivia y `71234567` | Llega el código al celular y se recupera la tarjeta |
| REC-08 | Abrir «Entra a tu tarjeta» | Dos pestañas, «Correo» y «Celular». En «Celular» aparece el selector con bandera, igual que en el registro. Si el celular no está habilitado, no hay pestañas: solo el correo |
| REC-06 | En «Correo»: enviar vacío, luego `hola`, luego `juan@` | «Escribe tu correo.»; «Correo incompleto.»; «Correo incompleto.». El mensaje se borra al volver a escribir |
| REC-09 | En «Celular»: escribir `aa`; luego `11` y enviar; luego `51234567` y enviar | `aa` no se escribe; «Celular incompleto.»; «El celular empieza con 6 o 7.» |
| REC-07 | Tocar «Enviarme un código» varias veces seguidas | Un solo código en la terminal |
| SES-01 | En la tarjeta, pulsar «Cerrar sesión» | Vuelve al registro. `/tarjeta/mi` ya no entra |
| SES-02 | Con la tarjeta abierta en dos navegadores, cerrar sesión en uno y recargar el otro | El otro también queda fuera (aviso de sesión cerrada) |
| SES-03 | Tras cerrar sesión, recuperar con el correo | Se vuelve a entrar a la misma tarjeta |

## 5. Botón de Wallet

| ID | Pasos | Resultado esperado |
|---|---|---|
| WAL-01 | Sin configurar Google Wallet, pulsar «Agregar a Google Wallet» | «Google Wallet aún no está disponible.». La tarjeta sigue funcionando |
| WAL-02 | Mirar el botón de Apple | «Apple Wallet · pronto», deshabilitado |
| WAL-03 | Con las variables `GOOGLE_WALLET_*` configuradas, en un Android real: pulsar el botón | Abre Google Wallet con la tarjeta «Sorteo Paseo»: puntos, participaciones, «Te faltan Bs 200», sorteo «20 dic» y el QR con el mismo código `PA-…` |
| WAL-04 | Tras WAL-03, volver a la página | El botón dice «Agregar otra vez a Google Wallet» |
| WAL-05 | Tras WAL-03, revocar el código (ADM-05) y abrir la tarjeta en Google Wallet | La **misma** tarjeta muestra el QR nuevo, sin tener que guardarla otra vez |
| WAL-06 | Tocar el botón varias veces seguidas | Una sola preparación («Preparando…») |

## 6. Estados de la campaña

Cambiar el estado en el admin de Django (Sorteo Paseo → Campañas, acciones «Pausar», «Cerrar», «Lanzar») y recargar la tarjeta.

| ID | Pasos | Resultado esperado |
|---|---|---|
| CAM-01 | Pausar la campaña | En vez del progreso: «El sorteo está en pausa. Tu tarjeta sigue aquí.». El QR sigue visible. Wallet deshabilitado con «Disponible cuando el sorteo esté activo.» |
| CAM-02 | Volver a lanzarla | Reaparece el progreso |
| CAM-03 | Cerrar la campaña | «El sorteo terminó. ¡Gracias por participar!» y, bajo el botón de Wallet, «El sorteo terminó.» |
| CAM-04 | Sin ninguna campaña lanzada (base nueva sin el paso de `crear_campania_sorteo`) | El registro funciona igual. La tarjeta dice «El sorteo aún no empieza. Tu tarjeta ya está lista.» |
| CAM-05 | Con una campaña activa, crear otra y lanzarla | Error «Ya hay otra campaña activa: páusala o ciérrala primero.». Sigue habiendo una sola activa |
| CAM-06 | En una campaña ya lanzada, cambiar «Bs por punto» o una fecha y guardar | Error «Las reglas de una campaña lanzada no se pueden cambiar…» |
| CAM-07 | En una campaña en borrador: cierre anterior al inicio; sorteo anterior al cierre | «El cierre no puede ser anterior al inicio.» y «El sorteo no puede ser anterior al cierre de la campaña.» |

## 7. El código resuelve la cuenta (caja y permisos)

Todavía no hay pantalla de caja (es la entrega 2): se prueba por API. Para obtener el token de un usuario de panel:

```bash
curl -s -X POST http://localhost:8001/api/v1/auth/login/ -H "Content-Type: application/json" -d "{\"email\":\"caja.cafe@paseo.bo\",\"password\":\"Paseo2026!\"}"
```

Copiar el `desafio`, leer el código en la terminal del backend y:

```bash
curl -s -X POST http://localhost:8001/api/v1/auth/verificar-codigo/ -H "Content-Type: application/json" -d "{\"desafio\":\"DESAFIO\",\"codigo\":\"123456\"}"
```

Copiar el valor de `access` (TOKEN) y resolver un código de tarjeta:

```bash
curl -s http://localhost:8001/api/v1/sorteo/resolver/PA-XXXXXX/ -H "Authorization: Bearer TOKEN"
```

| ID | Pasos | Resultado esperado |
|---|---|---|
| RES-01 | Resolver el código como cajero (`caja.cafe@paseo.bo`) | `{"referencia": "…", "nombre": "María G. P.", "campania_activa": true}`. **Sin** correo, celular ni apellidos completos |
| RES-02 | Lo mismo como negocio (`cafearanjuez@paseo.bo`) | Igual que RES-01 |
| RES-03 | Lo mismo como admin (`admin@paseo.bo`) | Además: nombres, apellidos, correo, celular, si cada contacto está verificado, estado y `posibles_duplicados`. Es la misma persona que se registró |
| RES-04 | Sin la cabecera `Authorization` | 401 |
| RES-05 | Como cliente, portero u oficina | 403 |
| RES-06 | Un código inventado (`PA-AAAAAA`) o con mala forma (`hola`) | 404 con «Esta tarjeta no es válida. Pide al cliente que abra su tarjeta de nuevo.» |
| RES-07 | El código en minúsculas (`pa-xxxxxx`) | Resuelve igual |
| RES-08 | En el admin de Django, desactivar la empresa del cajero y repetir RES-01 | 403 |
| RES-09 | Tras RES-01, abrir en el admin Sorteo Paseo → Eventos de auditoría | Un evento «Tarjeta consultada en caja» con el cajero y su empresa |
| RES-10 | Usar la sesión de la tarjeta (no la del panel) para resolver | 401: la sesión del cliente no sirve en rutas de caja |

## 8. Admin de Django (Sorteo Paseo)

| ID | Pasos | Resultado esperado |
|---|---|---|
| ADM-01 | Abrir Cuentas de fidelización | Lista con nombres, correo, celular, estado y «Posibles duplicados» |
| ADM-02 | Buscar por el código `PA-…` de una tarjeta | Aparece su cuenta |
| ADM-03 | Registrar otra tarjeta con el mismo celular y otro correo (o con un alias `maria+2@ejemplo.com`) | Ambas cuentas muestran «⚠ 1» en «Posibles duplicados» |
| ADM-04 | Abrir una cuenta | Abajo, sus códigos de tarjeta (activo y revocados). Los campos de verificación son de solo lectura |
| ADM-05 | Seleccionar una cuenta → acción «Revocar el código de la tarjeta y emitir uno nuevo» | Mensaje con el código nuevo. La tarjeta del cliente muestra el nuevo al recargar. El viejo da 404 en RES-01 y el nuevo resuelve la misma cuenta |
| ADM-06 | Cambiar el estado de una cuenta a «Bloqueada» y recargar su tarjeta | Pantalla «Tu tarjeta está bloqueada. Pide ayuda en el mostrador.». Su código da 404 en caja. Al volver a «Activa», todo funciona de nuevo |
| ADM-07 | Agotar los códigos de un contacto («Pediste muchos códigos hoy…») → acción «Desbloquear los envíos de código» | La persona puede pedir un código otra vez |
| ADM-08 | Cambiar el correo de una cuenta verificada y guardar | Aviso amarillo: el correo «quedó SIN verificar». Con ese correo nuevo ya no se puede recuperar la tarjeta |
| ADM-09 | Guardar un celular `abcdefgh` o un nombre `Ana123` | Error en el formulario; no se guarda |
| ADM-10 | Pasar a «Pendiente» una cuenta con un contacto verificado | Error «…no puede volver a «pendiente»: bloquéala si hace falta.» |
| ADM-11 | Ejecutar `python manage.py limpiar_sorteo` | «Borrados N códigos de verificación, N cuentas sin verificar y N consultas de caja antiguas.». Las cuentas verificadas siguen ahí |

## 9. Límites y fallos del servicio

| ID | Pasos | Resultado esperado |
|---|---|---|
| LIM-01 | Pedir códigos para el mismo contacto (reenviar o recuperar) esperando 60 s entre cada uno | Desde la misma red, al sexto: «Pediste muchos códigos hoy. Prueba mañana. Si necesitas ayuda, pídela en el mostrador.» |
| LIM-02 | Tras LIM-01, registrar a otra persona con otro correo | Funciona: el tope es por contacto |
| FAL-01 | Detener el backend y abrir `/tarjeta` | Aviso «No disponible por ahora. Prueba en unos minutos. Puedes seguir.» con «Reintentar». El formulario sigue visible |
| FAL-02 | Con el backend detenido, enviar el formulario | «No disponible por ahora. Prueba en unos minutos.». Al encenderlo y reenviar, funciona |
| FAL-03 | Con el backend detenido, abrir `/tarjeta/mi` con sesión | Error con botón «Reintentar»; al encender el backend y pulsarlo, carga la tarjeta |

## 10. Interfaz

| ID | Pasos | Resultado esperado |
|---|---|---|
| UI-01 | Recorrer registro, verificación, recuperación y tarjeta a 320 px de ancho | Nada se sale de la pantalla ni obliga a desplazarse hacia los lados. Las seis casillas caben en la columna |
| UI-02 | Lo mismo en escritorio | Contenido centrado en una columna angosta |
| UI-03 | Recorrer el registro solo con teclado (Tab, Espacio, Enter) | Se llega a todos los campos en orden y Enter envía el formulario |
| UI-04 | En el celular, tocar el campo de celular y las casillas del código | Se abre el teclado numérico |
| UI-05 | Botón «atrás» del navegador desde la tarjeta | No vuelve a mostrar el código de verificación ya usado |

## Lo que estos casos no cubren

- Registrar y aprobar compras, y que la tarjeta sume puntos (entrega 2).
- La pantalla de caja para escanear el QR (entrega 2): aquí la resolución se prueba por API.
- Apple Wallet (falta la cuenta de desarrollador) y el envío real del código al celular (falta proveedor).
- En el VPS: que los límites vean la IP real de cada visitante (ver `deploy/README.md`).
