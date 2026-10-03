---
tags: [tecnico, api]
---

# API (`/api/v1/`)

Base local: `http://localhost:8001/api/v1/` · Refresh del token: `POST /auth/token/refresh/`

## Autenticación (público)
| Método y ruta | Qué hace |
|---|---|
| `POST auth/registro/` | Registro de cliente → `{ paso, desafio }` |
| `POST auth/login/` | Correo + contraseña → envía código → `{ paso, desafio }` |
| `POST auth/verificar-codigo/` | `{ desafio, codigo }` → `{ access, refresh, usuario }` |
| `POST auth/reenviar-codigo/` | Nuevo código (espera 60 s) |
| `GET auth/yo/` | Perfil del usuario actual |
| `POST auth/cambiar-password/` | Cambio de contraseña |

## Público (app y web)
`GET empresas/` · `GET empresas/{id}/` (horarios, productos, ofertas vigentes) · `GET categorias/`

## Cliente
| Ruta | Qué hace |
|---|---|
| `GET puntos/monedero/` | Saldo y cuánto falta para la siguiente recompensa |
| `GET puntos/mi-qr/` | QR personal dinámico (vence en 2 min) |
| `GET puntos/empresa/{codigo}/` | Nombre y logo de la empresa escaneada |
| `GET/POST puntos/solicitudes/` | Solicitar puntos por compra (`codigo`, `nit`, `monto`) |
| `GET puntos/movimientos/` | Historial |
| `GET puntos/recompensas/` | Catálogo activo |

## Portero
`POST porteria/visitas/` (`token` del QR del cliente) · `GET porteria/visitas/` (las de hoy)

## Caja (negocio o cajero)
`GET caja/solicitudes/?estado=pendiente` · `POST caja/solicitudes/{id}/aprobar/` · `POST caja/solicitudes/{id}/rechazar/` (`motivo`)

## Empresa (negocio u oficina)
`GET/PATCH mi-empresa/` · `GET/PUT mi-empresa/horarios/` · CRUD `mi-empresa/productos/` y `mi-empresa/ofertas/` · `GET mi-empresa/codigo/` · `POST mi-empresa/codigo/regenerar/`

## Admin
| Ruta | Qué hace |
|---|---|
| `admin/empresas/` (+ `{id}/reenviar-acceso/`) | Alta y gestión de empresas |
| `admin/categorias/` | Categorías |
| `admin/porteros/` (+ `{id}/reenviar-acceso/`) | Porteros |
| `admin/usuarios/` | Lista de usuarios, activar/desactivar |
| `admin/recompensas/` | Catálogo de recompensas |
| `GET/PUT admin/configuracion-puntos/` | Reglas de puntos y límites |
| `GET admin/solicitudes/`, `GET admin/visitas/` | Registros |
| `admin/reportes/...` | Ver [[Dashboard admin]] |
