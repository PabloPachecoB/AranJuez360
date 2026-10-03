# Prototipo 1 — Paseo Points

Base: rama reto3-paseoya, commit ac1c745. Trabajo local en codex/paseo-points-prototipo; no publicado en GitHub.

## Ejecutar en Windows

Desde la raíz del repositorio, con Python 3.12 y Node disponibles:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
$env:DEBUG='True'
$env:USE_LOCAL_DB='True'
$env:EMAIL_BACKEND='django.core.mail.backends.console.EmailBackend'
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py demo_points
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8001
```

En otra terminal:

```powershell
cd web
npm ci
npm run dev
```

Abrir http://localhost:3000. El comando demo_points imprime credenciales aleatorias únicamente al crear cada cuenta. Conserva esas credenciales; al repetir no reemplaza contraseñas ni duplica puntos. El inicio de sesión utiliza correo y contraseña, sin código de verificación. No se envían correos de acceso.

## Qué probar

1. Entrar como visitante.points@example.test; ver puntos, elegir beneficio y confirmar.
2. Copiar el código generado y salir.
3. Entrar como caja.points@example.test; consultar código y confirmar entrega. Un segundo intento debe rechazarse.
4. Entrar como admin.points@example.test y abrir Paseo Points; crear borrador y activar/pausar.

Todo dato DEMO es ficticio. Los costos no son una propuesta económica validada.

## Integración de los tres retos

Se reutilizan autenticación, Usuario, Empresa y Pedido existentes de Django. La base documental original tiene nombres diferentes: este incremento sigue el código de reto3-paseoya, no crea un segundo backend ni tablas paralelas de usuarios.

- GET /api/v1/recompensas/: beneficios; administración también ve borradores.
- POST /api/v1/recompensas/ y PATCH /api/v1/recompensas/{id}/: administración.
- POST /api/v1/recompensas/{id}/canjear/: cliente, JSON {"clave_operacion":"UUID"}. Conservar la misma clave al reintentar una operación cuya respuesta se perdió. Un nuevo canje intencional necesita otra clave.
- GET /api/v1/cupones/: solo cupones propios.
- POST /api/v1/cupones/consultar/ y /validar/: caja del negocio responsable, JSON {"codigo":"24 caracteres hexadecimales"}.
- El retiro presencial de PaseoYa acredita puntos en la misma transacción. Un pedido tiene como máximo un abono. No se recalculan pedidos históricos ya entregados.
- Jarvis puede consultar beneficios mediante la API autenticada; un canje siempre requiere confirmación explícita del usuario. La conexión de herramientas de Jarvis queda pendiente con su pareja.

El cupón conserva el beneficio y costo originales aunque se edite la recompensa. Se descuenta al emitir; validarlo no descuenta otra vez. Pausar un beneficio impide nuevos canjes, pero los cupones emitidos siguen aceptándose.

## Pendiente antes de un piloto real

La primera interfaz es web adaptable a celular. La pantalla nativa de Expo, escaneo de cupones por cámara y conexión de Jarvis no están implementados en este incremento.

Faltan acuerdos sobre quién financia cada premio, reglas de acumulación, disponibilidad, devolución de puntos por cancelación, caducidad y atención de reclamos. No activar beneficios reales hasta acordarlos. No hay inventario/cupo de premios ni caducidad automática todavía.

La solicitud manual de puntos de la base y los pedidos son dos mecanismos distintos: todavía no comparten un identificador de comprobante que impida reclamar la misma compra por ambas vías. Para un piloto, caja debe usar una sola vía por compra; automatizar esa conciliación antes de ampliar el uso.

Se verifica localmente con SQLite. Los bloqueos select_for_update están orientados a PostgreSQL: falta verificar concurrencia contra PostgreSQL antes del despliegue. No se ha desplegado ni publicado.

## Insumos de Jorge y Ricardo

- Jorge: respuestas de visitantes, dificultades observadas al registrarse y preferencia entre web y app; pedir a 3 visitantes que prueben este flujo sin explicarles los botones.
- Ricardo: al menos un negocio dispuesto a probar; beneficio exacto, costo real, responsable de caja, condiciones, forma de comprobar compras y quién autoriza promociones en Paseo Aranjuez.
- Ambos: entregar resultados agregados sin datos personales innecesarios y coordinar con reto3 la revisión del pequeño cambio en pedidos/services.py antes de fusionar.

## Verificación

```powershell
cd backend
$env:DEBUG='True'
$env:USE_LOCAL_DB='True'
..\.venv\Scripts\python.exe manage.py test fidelizacion usuarios empresas pedidos reportes --noinput
..\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
cd ../web
npm run build
```
