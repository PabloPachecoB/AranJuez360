# Entrega 1 · Registro público y cuenta de fidelización (Wallet)

Alcance: la tarea «[Wallet] Implementar registro público y cuenta de fidelización». Contexto general en
[`../FIDELIZACION_EQUIPO.md`](../FIDELIZACION_EQUIPO.md). Este documento es plan y contrato de la primera
entrega; no certifica que esté desplegada.

**Criterio de aceptación.** Una persona registra y recupera su cuenta. El código de su tarjeta resuelve esa
misma cuenta con los permisos correspondientes.

## 0. Estado (2026-11-19)

Implementado en la rama `feature/wallet-registro-cuenta`. Comprobado en local:

- Pruebas de `sorteo` (173) y batería existente del backend; `npm run build` y `oxlint` de `web/`.
- Exploración profunda (cartas de datos, abuso, sesión/concurrencia, interfaz y migraciones) con un PostgreSQL
  desechable: 21 hallazgos, todos corregidos y vueltos a probar.
- Segunda exploración (fuzzing de la API, admin de Django, modo simulado, nombres largos, rutas y despliegue):
  15 hallazgos más, corregidos.
- Flujo real en el navegador (vista de celular): registro, verificación por correo y por celular, tarjeta con
  QR, recuperación desde otra sesión, cierre de sesión, y resolución del código como cajero por API.

Sin comprobar todavía: pase real en Google Wallet (Android físico y credenciales del emisor), envío real a
celular (no hay proveedor), Apple Wallet y la prueba e2e de Playwright (no escrita).

## 1. Alcance

Entra:

- Campaña mínima (nombre, estado, Bs por punto, fechas) y cuenta con nombres, apellidos, correo y celular.
- Verificación del contacto elegido y recuperación de la cuenta.
- Código opaco revocable, estado del pase y consulta de progreso.
- Página pública con botón para guardar la tarjeta y vista de progreso del cliente.

No entra (entregas siguientes): registrar y aprobar compras, locales participantes, panel admin de
participantes/ranking/facturas/OCR, emisión real del pase de Apple, vinculación con la cuenta de la app.

## 2. Hallazgos del código y decisiones

1. **Revocar el código obligaría a volver a guardar la tarjeta.** `wallet_google.py` armaba el id del pase con el
   código del QR. Se separó un `pase_id` estable: revocar cambia solo el QR.
2. **`CodigoVerificacion` está atado a `Usuario`.** La cuenta de fidelización es independiente, así que usa un
   modelo de desafío propio con el mismo esquema (hash, vencimiento, intentos).
3. **No hay proveedor de SMS/WhatsApp.** El canal de celular es enchufable (`SORTEO_CANAL_CELULAR`):
   `ninguno` (producción hasta elegir proveedor), `consola` (desarrollo).
4. **Los límites por IP deben ver la IP real y no poder falsificarse.** El Wi-Fi del Paseo comparte una sola IP y
   el Caddy interno reemplaza `X-Forwarded-For` por la IP del Caddy compartido. La IP se lee solo de la cabecera
   que fija nuestro Caddy (`X-Client-IP`), nunca de `X-Forwarded-For`; los límites son holgados, separados por
   tipo de ruta (la página de campaña no tiene) y se cuentan en una caché de archivos compartida por los 3
   workers. El control fino (reenvío, tope diario, intentos por código) está en base de datos.
5. **`puntos/codigo/<codigo>/` ya existe y es otra cosa.** Las rutas nuevas viven en `/api/v1/sorteo/`.
6. **`EsCaja` no comprueba que la empresa esté activa.** El permiso de `resolver` sí lo comprueba.
7. **El botón de Google Wallet no funciona en producción sin logo público** (`GOOGLE_WALLET_LOGO_URL`).
8. **Una persona puede tener más de una tarjeta.** Solo el contacto *verificado* es único: bloquear un contacto
   sin verificar permitiría que alguien «ocupe» el correo o el celular de otra persona. Las cuentas que
   comparten correo o celular se **señalan** al admin («posibles duplicados») para revisarlas antes de entregar
   un premio. Impedirlo de verdad exige otro dato de identidad (CI) o verificar los dos contactos: decisión
   pendiente del equipo.

9. **Dos toques seguidos no pueden crear dos tarjetas.** Se frenan en la página (referencia, no estado de React) y
   en el servidor (candado por contacto con `pg_advisory_xact_lock`: un `select_for_update` sobre cero filas no
   bloquea nada).
10. **Nadie puede bloquear a otra persona pidiendo códigos a su nombre.** Además del tope diario por contacto
    (10), cada IP puede gastar como máximo 5 de ellos. Riesgo residual: un atacante con 10 o más IPs distintas
    todavía puede agotar el cupo; por eso el mensaje indica acudir al mostrador y el admin tiene la acción
    «Desbloquear los envíos de código».

11. **Un contacto editado deja de estar verificado.** «Verificado» significa que la persona demostró que el correo o
    celular es suyo. Si se cambia (p. ej. desde el admin), el modelo le quita la verificación: de seguir marcado,
    su dueño real recibiría códigos que abren una tarjeta ajena. El admin avisa al guardar.

## 3. Backend: app Django `sorteo`

Añadida a `LOCAL_APPS` y a `paseo_erp/api_v1_urls.py` (prefijo `sorteo/`). No modifica los modelos de Paseo
Points. Reutiliza `fidelizacion/wallet_google.py`; único cambio allí: `EstadoTarjeta.pase_id`.

| Archivo | Contenido |
|---|---|
| `models.py` | `Campania`, `CuentaFidelizacion`, `CodigoTarjeta`, `PaseWallet`, `DesafioContacto`, `EventoAuditoria` |
| `errores.py` | `SorteoError` (código estable + mensaje + HTTP) |
| `codigos.py` | Código opaco de la tarjeta y código de 6 dígitos |
| `canales.py` | Envío por correo y por celular (enchufable) |
| `services.py` | Registrar, verificar, reenviar, recuperar, revocar, resolver, progreso, cerrar sesión y limpieza |
| `sesion.py` | Token del titular y su autenticación DRF |
| `permissions.py` | `EsTitular`, `PuedeResolverTarjeta` |
| `pase.py` | Estado del pase y publicación en Google Wallet |
| `serializers.py`, `views.py`, `api_v1_urls.py`, `admin.py` | API y admin de Django |
| `management/commands/crear_campania_sorteo.py` | Crea la campaña inicial |
| `management/commands/limpiar_sorteo.py` | Borra códigos viejos y cuentas nunca verificadas (correr a diario) |
| `tests/` | Un archivo por área |

### 3.1 Modelos

**`Campania`**: `nombre`, `estado` (BORRADOR, ACTIVA, PAUSADA, CERRADA), `bs_por_punto` (decimal, 200),
`inicio`, `cierre`, `fecha_sorteo`, `lanzada_por`, `lanzada_en`. Restricción en base de datos: una sola
campaña ACTIVA. Fuera de BORRADOR no se puede cambiar `bs_por_punto` ni las fechas (ni por admin ni por código).

**`CuentaFidelizacion`**: `referencia` (UUID opaco), `nombres`, `apellidos`, `correo` (minúsculas),
`correo_verificado_en`, `celular` (Bolivia: 8 dígitos sin +591; otro país: `+` y su código), `celular_verificado_en`, `estado` (PENDIENTE, ACTIVA,
BLOQUEADA), `usuario` (uno a uno, opcional, para vincular la app después), `acepto_terminos_en`,
`version_sesion`, `correo_canonico` (sin «+etiqueta» y sin puntos en Gmail, solo para señalar alias repetidos),
`creada_en`. Restricción: `correo` único entre cuentas con correo verificado; igual `celular`.

**`CodigoTarjeta`**: `cuenta`, `codigo` (único, `PA-` + 6 caracteres sin `0/O/1/I/L`), `activo`, `revocado_en`,
`revocado_por`, `motivo`. Un solo código activo por cuenta.

**`PaseWallet`**: `cuenta`, `plataforma` (GOOGLE, APPLE), `pase_id` (opaco, estable, único), `estado_sync`
(SIN_EMITIR, PENDIENTE, SINCRONIZADO, ERROR), `sincronizado_en`, `intentos`, `ultimo_error`. Un pase por cuenta
y plataforma.

**`DesafioContacto`**: `desafio` (UUID público), `cuenta` (opcional), `canal` (CORREO, CELULAR), `destino`,
`proposito` (REGISTRO, RECUPERAR), `codigo_hash`, `expira_en`, `intentos`, `usado`, `verificado_en` (solo si se
acertó el código: un desafío agotado o vencido todavía permite pedir otro), `ip_hash` (huella de la IP, no la
dirección) y `creado_en`. `cuenta`
es opcional para poder responder igual cuando se pide recuperar un contacto que no existe; ese desafío guarda
un hash imposible de acertar.

**`EventoAuditoria`**: `cuenta`, `tipo`, `actor` (usuario opcional), `detalle`, `creado_en`. Tipos: registro,
verificación, recuperación, código emitido/revocado, pase publicado/error, **consulta en caja**, sesión cerrada y
envíos desbloqueados.

### 3.2 Reglas

**Registro.** Celular con las reglas de la app (`^(\+591)?[67]\d{7}$`). Nombres y apellidos: solo letras (con
tildes, guion, apóstrofo y punto), sin números, símbolos ni emojis; si llegan todo en minúsculas o mayúsculas se
ordenan («luis alberto» → «Luis Alberto», «DE LA CRUZ» → «De la Cruz», «o'brien» → «O'Brien»). Los acentos
escritos como carácter aparte se normalizan antes de validar. Correo: debe tener dominio de internet (se rechazan
`a@localhost` y direcciones IP entre corchetes). Celular: de Bolivia, 8 dígitos (con o sin `+591`, `591` o `00591`),
guardado sin código de país; de otro país, con su código (`+54…`, `0054…`), guardado como `+` y los dígitos (E.164,
de 8 a 15). Sin código no se acepta un número que no sea boliviano. El registro ofrece un selector de país con bandera y código (`components/SelectorPais.tsx`; las banderas van
dibujadas porque Windows no trae banderas en su fuente de emoji). El
registro no exige
campaña activa.
Si el contacto elegido ya está verificado en otra cuenta, no se crea nada: se envía un código de recuperación a
ese contacto y la respuesta es idéntica a la de un registro nuevo (no se revela quién existe). Si había una
cuenta PENDIENTE con ese contacto, se reutiliza y se actualizan sus datos.

**Verificación.** Código correcto: se marca el contacto como verificado, la cuenta pasa a ACTIVA y se emite
su `CodigoTarjeta` si no tiene. Incorrecto: suma un intento; al quinto se invalida. Vence a los 10 minutos
(`CODIGO_VERIFICACION_MINUTOS`, `CODIGO_VERIFICACION_INTENTOS`). Si el contacto quedó verificado en otra cuenta
mientras tanto, responde `contacto_en_uso`.

**Recuperación.** Respuesta siempre igual, exista o no la cuenta. Solo se envía código si el contacto está
verificado en una cuenta ACTIVA (la página avisa: «usa el contacto con el que verificaste tu tarjeta»). Al
verificar sube `version_sesion` y cierra las sesiones anteriores.

**Reenvío.** Se puede pedir otro código desde el último desafío del contacto aunque se haya agotado (5 intentos) o
vencido; no desde uno ya verificado ni desde uno reemplazado por otro más nuevo. Verificar con un desafío agotado
responde `codigo_agotado` («Pide uno nuevo con Reenviar código») y la página lo conserva; solo `desafio_invalido`
(inexistente o ya verificado) obliga a empezar de nuevo.

**Envío fallido.** Si el correo no sale (SMTP caído), responde `envio_fallido` (503), no queda cuenta ni desafío
a medias y el intento no cuenta para la espera ni para el tope diario.

**Límites.** En base de datos: reenvío a los 60 s; máximo 10 códigos por contacto en 24 h (`SORTEO_ENVIOS_DIA`) y
5 por IP para ese contacto (`SORTEO_ENVIOS_DIA_POR_IP`). Por IP (holgados, ver hallazgo 4): `sorteo_envio` para
registro/reenvío/recuperación y `sorteo_verificar` para la verificación. `campania/` no tiene límite.
`resolver/` tiene límite **por usuario** (`sorteo_resolver`). Al superarlos: `demasiadas_peticiones` (429) con
mensaje en español; al superar el tope diario: `limite_envios`, con la indicación de acudir al mostrador.

**Cuenta bloqueada.** Con una sesión vigente, `mi-tarjeta/` responde 403 `cuenta_bloqueada` («Acércate al
mostrador»), no «tu sesión venció». Recuperar responde lo mismo y no envía nada.

**Mensajes claros (decisión de producto).** La app dice qué pasa en pocas palabras: al entrar con un dato sin
tarjeta responde `sin_tarjeta` con un mensaje corto («Correo inválido.» o «Celular inválido.»), y al registrarse con un dato ya confirmado responde `contacto_registrado`
(«Ya tienes una tarjeta con ese correo. Entra a tu tarjeta.»). Los datos mal escritos se avisan en la página
antes de enviar («Correo incompleto.», «Celular incompleto.», «El celular empieza con 6 o 7.») y el campo de
celular solo acepta números (`web/src/fidelizacion/validacion.ts`, mismas reglas que `services.mensaje_correo` y
`services.mensaje_celular`). **Costo asumido:** cualquiera puede saber si un correo o celular tiene tarjeta. Lo
contienen los límites por IP y por contacto; no se envía ningún código en esos casos, así que tampoco se puede
usar para llenar de mensajes a un tercero.

**Duplicados.** Se permiten varias tarjetas por persona, pero el admin ve «posibles duplicados»: cuentas con el
mismo celular o con el mismo correo canónico (alias `a+1@gmail.com`, `a.b@gmail.com`).

**Revocación.** Marca el código activo como revocado y emite otro en la misma transacción. El `pase_id` no
cambia; el pase se vuelve a publicar con el QR nuevo (si falla, queda PENDIENTE/ERROR y se reintenta).

**Consulta en caja.** Cada resolución correcta deja un evento con el usuario y su empresa. Las consultas a
códigos inválidos se anotan en el log del servidor.

**Progreso.** `puntos = floor(total / bs_por_punto)`, `participaciones = puntos`, `sobrante = total - puntos × bs`,
`faltan = bs - sobrante`. Todo en `Decimal`. En esta entrega el total aprobado es 0 (aún no hay compras); la
función recibe el total como parámetro para que la entrega 2 solo conecte la suma.

**Admin de Django.** El formulario de cuentas aplica las reglas del registro (nombres solo con letras, correo con
dominio, celular boliviano normalizado) y no deja volver a PENDIENTE una cuenta con un contacto verificado. Las
campañas validan el orden de sus fechas (inicio ≤ cierre ≤ sorteo), también en `crear_campania_sorteo`, y las
restricciones muestran mensajes claros («Ya hay otra campaña activa…»). El listado calcula «posibles duplicados»
en una sola consulta.

**Limpieza.** `limpiar_sorteo` borra desafíos de más de 2 días (nunca los de las últimas 24 h, que sostienen el
tope diario), cuentas PENDIENTES de más de 7 días sin ningún contacto verificado y consultas de caja de más de
180 días. La auditoría de registro, verificación y revocación se conserva siempre.

### 3.3 Sesión del titular

Token firmado (`django.core.signing`, sal `sorteo.sesion`) con el id de la cuenta y su `version_sesion`; dura
`SORTEO_SESION_DIAS` (30). Viaja en `Authorization: Tarjeta <token>` (el esquema no distingue mayúsculas). La autenticación deja el titular en
`request.user` como objeto sin rol y solo se declara en las vistas del titular: no puede pasar ningún permiso de
los paneles. «Cerrar sesión» sube `version_sesion` en el servidor: el token deja de valer en todos los
dispositivos, no solo se borra del navegador.

### 3.4 Rutas (`/api/v1/sorteo/`)

| Método y ruta | Quién | Entrada | Salida |
|---|---|---|---|
| `GET campania/` | Público | — | `activa`, `estado` (ACTIVA, PAUSADA, CERRADA, SIN_CAMPANIA), `nombre`, `bs_por_punto`, `fecha_sorteo`, `canales`, `terminos_url` (solo https) |
| `POST registro/` | Público | `nombres`, `apellidos`, `correo`, `celular`, `canal`, `acepta_terminos` | `desafio`, `canal`, `destino` (enmascarado), `vence_en_minutos` |
| `POST verificar/` | Público | `desafio`, `codigo` | `sesion`, `tarjeta` |
| `POST reenviar/` | Público | `desafio` | igual que `registro/` |
| `POST recuperar/` | Público | `contacto` (correo o celular) | igual que `registro/` |
| `GET mi-tarjeta/` | Titular | — | `tarjeta` |
| `POST mi-tarjeta/cerrar-sesion/` | Titular | — | 204 |
| `POST mi-tarjeta/google-wallet/` | Titular | — | `url`, `estado` |
| `POST mi-tarjeta/apple-wallet/` | Titular | — | error `apple_pendiente` |
| `GET resolver/<codigo>/` | NEGOCIO, CAJERO o ADMIN | — | Cuenta reducida (admin: completa) |
| `POST admin/cuentas/<id>/revocar-codigo/` | ADMIN | `motivo` | `codigo` nuevo |

Ejemplo de `tarjeta`:

```json
{
  "codigo": "PA-7K3M9X",
  "primer_nombre": "María",
  "campania": { "activa": true, "estado": "ACTIVA", "nombre": "Sorteo Paseo", "bs_por_punto": "200.00", "fecha_sorteo": "2026-12-20" },
  "progreso": { "total_aprobado": "0.00", "puntos": 0, "participaciones": 0, "sobrante": "0.00", "faltan": "200.00", "pendientes": 0 },
  "pases": { "google": "SIN_EMITIR", "apple": "NO_DISPONIBLE" }
}
```

`progreso` es `null` mientras no haya una campaña activa.

Ejemplo de `resolver` para negocio o cajero (nunca correo ni celular):

```json
{ "referencia": "5b0f2c1e-3c2a-4d63-9a0e-1f6f0f2c9a11", "nombre": "María G. P.", "campania_activa": true }
```

El admin recibe además `id`, nombres, apellidos, correo, celular, verificación de cada contacto, estado y
`posibles_duplicados`.

Todas las respuestas del sorteo llevan `Cache-Control: no-store`; los 429 por límite llevan `Retry-After`. Un JSON
anidado en exceso responde 400 (`paseo_erp/parsers.py`, que vale para toda la API, incluido el login).

**Errores estables.** Cuerpo `{"detail": "...", "codigo": "..."}`. Los errores de validación de un campo llegan
como `{"campo": ["mensaje"]}`.

| `codigo` | HTTP | Cuándo |
|---|---|---|
| `qr_invalido` | 404 | Código inexistente, revocado o de una cuenta bloqueada (misma respuesta, sin pistas) |
| `campania_inactiva` | 409 | No hay campaña activa (al publicar el pase) |
| `desafio_invalido` | 400 | El desafío no existe o ya se verificó |
| `codigo_agotado` | 400 | El código se agotó, venció o lo reemplazó otro: se pide uno nuevo con «Reenviar» |
| `codigo_incorrecto`, `codigo_vencido`, `demasiados_intentos` | 400 | Verificación |
| `contacto_invalido` | 400 | En recuperación: correo o celular mal escrito (el mensaje dice qué le falta) |
| `sin_tarjeta` | 404 | En recuperación: no hay una tarjeta con ese correo o celular confirmado |
| `contacto_registrado` | 409 | En registro: ese correo o celular ya tiene una tarjeta |
| `contacto_en_uso` | 409 | El contacto ya quedó verificado en otra cuenta |
| `cuenta_bloqueada` | 403 | La cuenta está bloqueada (al verificar y con una sesión vigente) |
| `espera_reenvio`, `limite_envios` | 429 | Reenvío y tope diario por contacto o por IP |
| `demasiadas_peticiones` | 429 | Límite por IP (o por usuario en `resolver`) |
| `canal_no_disponible` | 400 | Canal de celular sin proveedor configurado |
| `envio_fallido` | 503 | No se pudo enviar el código |
| `sesion_invalida` | 401 | Token vencido o cerrado (recuperación o cierre de sesión) |
| `wallet_no_configurado` | 503 | Faltan variables de Google Wallet |
| `wallet_error` | 503 | Google rechazó la publicación |
| `apple_pendiente` | 501 | Apple aún sin certificados |

**Permisos de `resolver`.** Anónimo o token de titular: 401. CLIENTE, OFICINA, PORTERO: 403. NEGOCIO o CAJERO sin
empresa o con empresa inactiva: 403. La `referencia` es opaca, no el id de la tabla.

### 3.5 Cambio en Google Wallet

`EstadoTarjeta` gana `pase_id` (opcional; si está vacío usa el código, así los pases de prueba actuales no
cambian). `objeto_lealtad` usa `pase_id` para el `id` del objeto y deja `codigo` en el QR y `accountId`.
`enlace_guardar_existente` recibe el `pase_id`. La clase se publica solo al crear el primer pase de una cuenta
(no se reenvía a revisión en cada actualización).

### 3.6 Variables nuevas

| Variable | Valor por defecto |
|---|---|
| `SORTEO_CANAL_CELULAR` | `consola` con `DEBUG`, `ninguno` si no |
| `SORTEO_SESION_DIAS` | `30` |
| `SORTEO_ENVIOS_DIA` | `10` (por contacto) |
| `SORTEO_ENVIOS_DIA_POR_IP` | `5` (por IP y contacto) |
| `SORTEO_IP_HEADER` | vacío; en el VPS `X-Client-IP` (ver sección 7) |
| `SORTEO_THROTTLE_CACHE_DIR` | `/tmp/paseo_sorteo_throttle` (caché de archivos de los límites, hasta 100.000 entradas) |
| `SORTEO_TERMINOS_URL` | vacío (el registro no muestra enlace); solo se acepta `https://` |
| `SORTEO_ENVIO_THROTTLE` | `60/min` por IP |
| `SORTEO_VERIFICAR_THROTTLE` | `120/min` por IP |
| `SORTEO_RESOLVER_THROTTLE` | `60/min` por usuario de caja |

## 4. Frontend: `web/src/fidelizacion/`

| Archivo | Contenido |
|---|---|
| `TarjetaApp.tsx` | Rutas públicas |
| `api.ts`, `sesion.ts`, `tipos.ts`, `formato.ts` | Llamadas a `/sorteo/` con la cabecera `Tarjeta`, sesión en `localStorage` (`paseo_tarjeta_sesion`), tipos del contrato y formato de Bs y fechas |
| `simulacion.ts` | Respuestas de ejemplo solo en desarrollo (`VITE_SORTEO_SIMULADO=1`), con franja visible; código simulado `123456` |
| `pages/RegistroPage.tsx`, `VerificarPage.tsx`, `RecuperarPage.tsx`, `MiTarjetaPage.tsx` | Las cuatro pantallas |
| `components/Marco.tsx`, `CampoCodigo.tsx`, `BarraProgreso.tsx`, `BotonesWallet.tsx` | Marco visual (pone el título de la pestaña), casillas del código, barra y botones de Wallet |

Archivos compartidos tocados: `web/src/App.tsx`, una condición para abrir `/tarjeta` sin login (igual que
`/sitio/` y `/activar/`, sin distinguir mayúsculas), y `web/index.html`, que pasa de `lang="en"` a `lang="es"`
(toda la web está en español). Un nombre largo sin espacios se parte en líneas en vez de ensanchar la página.

| Ruta | Pantalla |
|---|---|
| `/tarjeta` | Registro: nombres, apellidos, correo, celular, canal de verificación y términos (con enlace si hay `terminos_url`). Con sesión, redirige a `/tarjeta/mi` |
| `/tarjeta/verificar` | Seis casillas, cuenta regresiva de reenvío, intentos restantes y ayuda «¿No te llega?» |
| `/tarjeta/recuperar` | Correo o celular → código → mismo flujo de verificación. Si la sesión se cerró en el servidor, lo explica |
| `/tarjeta/mi` | Puntos, participaciones, barra hacia el siguiente punto, «Te faltan Bs X», QR con el código en texto, fecha del sorteo, «Agregar a Google Wallet», Apple «próximamente» y «Cerrar sesión» |

Estados cubiertos: cargando, error de red o del servicio con «Reintentar» (el formulario de registro sigue
disponible si solo falla la carga de la campaña), campaña pausada, cerrada o inexistente (cada una con su texto),
sesión vencida, tarjeta bloqueada, Wallet no configurado. Los botones frenan el doble toque con una referencia, el
foco vuelve a la primera casilla tras un código incorrecto y las casillas se ajustan a pantallas de 320 px. Diseño: paleta y tipografías de `web/src/index.css`, primero para celular (se abre desde un QR en
el mostrador).

## 5. Pruebas

Backend (`python manage.py test sorteo`, además de la batería existente `usuarios empresas fidelizacion reportes`):

| Archivo | Casos |
|---|---|
| `test_registro.py` | Alta crea cuenta pendiente; datos inválidos; celular con `+591`; reutiliza la pendiente; contacto verificado responde `contacto_registrado` y no duplica cuenta |
| `test_verificacion.py` | Correcto activa y emite tarjeta; incorrecto resta intentos; vencido; quinto intento invalida; reenvío antes de 60 s; tope diario; contacto en uso |
| `test_recuperacion.py` | Sin tarjeta responde `sin_tarjeta` y no envía nada; dato mal escrito dice qué le falta; recuperar devuelve el mismo código; cierra sesiones anteriores; cuenta bloqueada |
| `test_codigo.py` | Formato y alfabeto; un solo activo; revocar emite otro; el viejo deja de resolver |
| `test_resolver.py` | Negocio/cajero reciben datos reducidos; admin todo; anónimo 401; cliente, oficina, portero y empresa inactiva 403; revocación por API |
| `test_progreso.py` | Total 0; Bs 380 → 1 punto y Bs 180; Bs 150 + 80 → 1 punto y Bs 30 |
| `test_campania.py` | Una sola activa; reglas bloqueadas tras lanzar; comando de campaña |
| `test_pase.py` | Publicar guarda SINCRONIZADO; fallo de Google guarda ERROR sin romper la cuenta; revocar conserva `pase_id` |
| `test_arreglos.py` | Candado por contacto; IP real (cabecera del proxy, `X-Forwarded-For` ignorado, caché compartida); límites por IP y tope diario; desbloqueo de envíos; reenvío tras agotar o vencer; `codigo_agotado`; cuenta bloqueada; NFC, correos, `00591`, iniciales; alias duplicados; estado de la campaña; limpieza de auditoría |
| `test_prefijos.py` | Celulares de Bolivia y de otros países (formatos, inválidos, enmascarado), registro, verificación y recuperación con un número del exterior |
| `test_claros.py` | Mensajes de correo y celular (vacío, incompleto, con letras, prefijo), en registro, recuperación y admin |
| `test_ronda3.py` | Contacto editado pierde la verificación (y su dueño real no recibe acceso); formulario del admin (celular, nombres, correo, estado); mensajes de restricciones; orden de fechas; listado sin consulta por fila; JSON anidado → 400; `Retry-After`; `no-store`; tamaño de la caché |
| `test_mejoras.py` | Límites separados y aviso en español; envío fallido; nombres (símbolos, mayúsculas); rastro de caja; cerrar sesión; duplicados señalados; enlace de términos; limpieza |

Frontend: `npm run build` en `web/`.

**Pendiente:** `e2e/tests/tarjeta.spec.ts` (registro leyendo el código de `tmp/e2e/correos`, recuperación en un
contexto de navegador nuevo y resolución del código como `cafearanjuez@paseo.bo`). Hasta ahora ese flujo se
comprobó a mano en el navegador.

## 6. Pendientes que dependen del equipo

- **Celular:** proveedor de WhatsApp o SMS y su costo. Sin él, la entrega sale con verificación solo por correo.
  Al elegirlo, confirmar que envía a otros países y a qué precio: el registro ya acepta celulares del exterior.
- **Textos:** todo lo que ve el cliente usa frases cortas y generales; mantener ese criterio en lo nuevo.
- **Logo público:** publicar `GOOGLE_WALLET_LOGO_URL` en el VPS; sin él, `wallet_no_configurado` en producción.
- **Apple:** cuenta de desarrollador y certificados.
- **Arranque seguro:** `SECRET_KEY` y `DEFAULT_FROM_EMAIL` tienen valores por defecto en `settings.py`
  (`dev-insecure-change-me`, `no-responder@localhost`). De la clave dependen los tokens de sesión de la tarjeta y
  los códigos de verificación: confirmar que el VPS define ambas. No se cambió el arranque para no afectar a
  entornos existentes.
- **Términos y condiciones:** publicar el texto y poner su dirección en `SORTEO_TERMINOS_URL`.
- **Una tarjeta por persona:** decidir si se pide CI o se verifican los dos contactos (ver hallazgo 8).
- **IP del cliente detrás de Caddy:** tras desplegar, validar `web/Caddyfile` (comando en `deploy/README.md`) y
  revisar que el log no muestre el aviso `SORTEO_IP_HEADER … no trae una IP válida`. No se pudo probar el Caddy
  real en local.
- **Tarea diaria:** programar `python manage.py limpiar_sorteo` en el servidor.

## 7. Despliegue: IP real y tareas

- `web/Caddyfile` confía en el Caddy compartido (`trusted_proxies static private_ranges`) y pasa la IP real a Django
  en `X-Client-IP` (`header_up`, no falsificable). `deploy/.env.example` trae `SORTEO_IP_HEADER=X-Client-IP`.
- Los contadores de los límites viven en una caché de archivos dentro del contenedor, compartida por los workers.
- Programar a diario `python manage.py limpiar_sorteo`.
- Quien quede bloqueado por el tope de códigos: acción «Desbloquear los envíos de código» en el admin de Django.
- Detalle y comandos en `deploy/README.md` (sección «IP real del visitante y límites del Sorteo Paseo»).
