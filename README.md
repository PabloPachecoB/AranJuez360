# AranJuez360 · Paseo Aranjuez 360

Plataforma del equipo para **Hackathon By Paseo 2026** (Paseo Aranjuez): app + web
para gestionar el ecosistema del Paseo. Reto principal: **Paseo Points**
(fidelización), con integración a oficinas y asistente IA.

Documentos del equipo en [`docs/`](./docs): documento base de la hackathon
([`BASE_PROYECTO_PASEO.md`](./docs/BASE_PROYECTO_PASEO.md)) y módulo PaseoYa
([`PASEOYA_MODULO.md`](./docs/PASEOYA_MODULO.md)).

## Estructura

```
app/              # app móvil (Expo / React Native): clientes y porteros
web/              # web (React + Vite): admin, negocios y oficinas — pendiente
docs/             # documentos del equipo y presentación
backend/
  paseo_erp/      # proyecto Django (settings, urls, API v1)
  usuarios/       # usuarios y roles; alta de porteros
  empresas/       # negocios, emprendimientos y oficinas: ficha, horarios, productos, ofertas, QR/NFC
  fidelizacion/   # puntos por visita (portería) y por compra (caja), movimientos, reglas
  reportes/       # estadísticas del dashboard administrativo
  agente/         # asistente conversacional (LangGraph)
```

## Arranque (app)

```bash
cd app
npm install
cp .env.example .env     # EXPO_PUBLIC_API_BASE = IP de tu PC (no localhost)
npx expo start           # escanea el QR con Expo Go
```

El backend debe escuchar en la red local: `python manage.py runserver 0.0.0.0:8000`
(y agrega tu IP a `ALLOWED_HOSTS` en `backend/.env`). El acceso con huella funciona
en Expo Go; el NFC requiere un development build.

## Arranque (backend)

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate      # Windows
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py cargar_demo        # datos de prueba (contraseña: Paseo2026!)
python manage.py runserver
python manage.py test usuarios empresas fidelizacion reportes
```

**Acceso con doble autenticación** (no existe login sin código):
1. `POST /api/v1/auth/login/` con `{email, password}` → envía un código de 6 dígitos al correo y devuelve `{paso, desafio}`.
2. `POST /api/v1/auth/verificar-codigo/` con `{desafio, codigo}` → `{access, refresh, usuario}`.
El registro (`auth/registro/`) también responde con un `desafio` para verificar el correo.
En desarrollo los correos (y los códigos) se imprimen en la consola del servidor.
Refresh: `POST /auth/token/refresh/`.
Cuentas de demo: `admin@paseo.bo`, `portero@paseo.bo`, `cliente@paseo.bo`,
`cafearanjuez@paseo.bo` (negocio), `dulcehogar@paseo.bo` (emprendimiento),
`estudiolegalandino@paseo.bo` (oficina), `caja.cafe@paseo.bo` (cajero).

## Roles

| Rol | Quién | Qué hace |
|---|---|---|
| ADMIN | Administración del Paseo | Gestiona empresas, porteros, reglas de puntos y ve todos los registros |
| PORTERO | Guardia de entrada | Escanea el QR del cliente y registra su ingreso (+puntos de visita) |
| CLIENTE | Usuario principal de la app | Acumula puntos por visitas y compras |
| NEGOCIO | Negocio o emprendimiento | Ficha, productos, ofertas, QR/NFC de caja y aprobación de compras |
| CAJERO | Personal de caja de un negocio | Solo atiende solicitudes de puntos |
| OFICINA | Empresa que alquila y brinda sus servicios aparte | Ficha y servicios; sin caja de puntos |

## Flujos

**Alta de establecimientos y porteros.** El admin crea la empresa (nombre, tipo:
negocio/emprendimiento/oficina, categoría, correo) o el portero. El sistema genera una contraseña temporal y la envía por correo (en
desarrollo se imprime en la consola). La empresa entra a la web, cambia su
contraseña y completa logo, piso, local, horarios, productos y ofertas.

**Puntos por visita.** El cliente muestra su QR personal en la app (firmado, vence
en 2 minutos y se renueva solo, así una captura no sirve). El portero lo escanea,
ve el nombre del cliente y registra el ingreso: +1 punto, una vez por día
(ambos valores configurables). Los ingresos extra se registran sin puntos.

**Puntos por compra.** Cada negocio/emprendimiento tiene un código propio para su QR y su sticker
NFC de caja (`paseo360://puntos/<codigo>`).
1. El cliente escanea con la app → ve nombre y logo de la empresa.
2. Ingresa NIT y monto, confirma con huella/Face ID → solicitud `PENDIENTE`.
3. Caja la compara con el ticket y la **aprueba** o **rechaza**.
4. Al aprobar se acreditan los puntos (`Bs 1 = 1 punto`, configurable).

Reglas antiabuso: una solicitud pendiente por empresa, límite diario por empresa,
monto máximo y códigos QR/NFC regenerables.

## API v1 (`/api/v1/`)

| Quién | Ruta | Qué hace |
|---|---|---|
| Público | `POST auth/registro/`, `auth/login/`, `auth/verificar-codigo/`, `auth/reenviar-codigo/` | Registro con verificación de correo y login con código |
| Admin | `admin/porteros/` (+ `{id}/reenviar-acceso/`) | Alta y desactivación de porteros |
| Admin | `GET admin/visitas/?fecha=` | Ingresos registrados por portería |
| Cliente | `GET puntos/mi-qr/` | QR personal dinámico para portería |
| Portero | `POST porteria/visitas/`, `GET porteria/visitas/` | Registrar ingreso y ver los de hoy |
| Todos | `GET auth/yo/`, `POST auth/cambiar-password/` | Perfil y cambio de contraseña |
| Público | `GET empresas/`, `GET empresas/{id}/`, `GET categorias/` | Directorio con horarios, productos y ofertas vigentes |
| Admin | `admin/empresas/` (+ `{id}/reenviar-acceso/`) | Alta, edición y activación de empresas |
| Admin | `admin/categorias/` | Categorías |
| Admin | `GET/PUT admin/configuracion-puntos/` | Equivalencia de puntos y límites |
| Admin | `GET admin/solicitudes/?empresa=&estado=` | Registros de todas las empresas |
| Admin | `GET/PATCH admin/usuarios/?rol=&activo=&sin_activar=&buscar=` | Usuarios con rol, correo, estado y último ingreso; activar/desactivar |
| Empresa | `GET/PATCH mi-empresa/` | Ficha (logo, piso, local, referencia…) |
| Empresa | `GET/PUT mi-empresa/horarios/` | Horario semanal |
| Empresa | `mi-empresa/productos/`, `mi-empresa/ofertas/` | CRUD |
| Empresa | `GET mi-empresa/codigo/`, `POST mi-empresa/codigo/regenerar/` | Contenido del QR/NFC |
| Cliente | `GET puntos/empresa/{codigo}/` | Datos de la empresa escaneada |
| Cliente | `GET/POST puntos/solicitudes/`, `GET puntos/movimientos/` | Solicitar puntos e historial |
| Caja | `GET caja/solicitudes/?estado=pendiente`, `POST caja/solicitudes/{id}/aprobar/` · `rechazar/` | Atender solicitudes |

## Dashboard admin (`/api/v1/admin/reportes/`)

Todos aceptan `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` (por defecto, últimos 30 días).

| Ruta | Qué devuelve |
|---|---|
| `resumen/` | Visitas, clientes distintos y nuevos, compras, monto, puntos entregados/canjeados, rechazos (vs. periodo anterior), pendientes y puntos en circulación |
| `usuarios-por-rol/` | Total, activos y sin activar por rol |
| `visitas-por-dia/`, `compras-por-dia/` | Series diarias |
| `horas-pico/`, `dias-semana/` | Distribución de visitas |
| `empresas/ranking/?tipo=` | Compras, monto, puntos, clientes y tasa de rechazo por empresa |
| `empresas/sin-actividad/?dias=30` | Empresas sin compras registradas |
| `clientes/frecuentes/?orden=visitas\|compras` | Ranking de clientes |
| `clientes/dormidos/?dias=30` | Clientes que no vuelven |
| `clientes/{id}/historial/` | Ficha del cliente: tiendas ordenadas por tickets de fidelización, totales y últimos movimientos |

Solo se mide lo que pasa por el sistema: visitas = clientes registrados en
portería; compras = tickets aprobados en caja (no las ventas totales de cada tienda).

## Pendiente

- Recompensas y canje (catálogo, cupones, validación en caja).
- Dashboard / estadísticas y detección de irregularidades.
- Gestión de cajeros por la empresa.
- Oficinas: invitaciones QR y control de acceso.
- Frontends: `/web` (React + Vite, admin y empresa) y `/app` (React Native).

## Flujo de trabajo

Cada persona trabaja en su propia rama y la une a `main` cuando su parte funciona.
