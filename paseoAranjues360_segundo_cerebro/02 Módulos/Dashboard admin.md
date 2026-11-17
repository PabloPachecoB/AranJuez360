---
tags: [modulos, web, dashboard]
---

# Dashboard admin

Web en **http://localhost:3000** (React + Vite + Recharts). Solo rol ADMIN.

## Inicio
- Periodo: **7 / 30 / 90 días**.
- **8 indicadores** comparados con el periodo anterior: visitas, clientes distintos, clientes nuevos, compras registradas, monto registrado, puntos entregados, puntos en circulación, solicitudes pendientes.
- Gráficos (con tooltip al pasar el mouse):
  - Visitas por día (azul) · Compras por día (naranja)
  - Horas pico · Días de la semana
- **Perfil de los clientes** (2026-10-04): por rango de edad (menos de 18, 18–24, 25–34, 35–44, 45–59, 60+) y por ocupación (colegio, universidad, profesional, otro), con visitas, compras y monto, más la edad promedio. Endpoint `clientes/perfil/`.
- Tablas: empresas con más actividad (compras, monto, clientes, % rechazo), clientes frecuentes, clientes que no vuelven (14 días), usuarios por rol.

## Otras páginas
- **Usuarios**: rol, correo, estado, cuentas sin activar, alta, último ingreso; filtros y búsqueda; activar/desactivar (no se puede desactivar a sí mismo; el rol no se edita ahí).
- **Empresas**: lista con estado de la ficha; registrar empresa (envía credenciales); reenviar acceso; activar/desactivar.
- **Historial del cliente**: puntos, visitas, tickets, monto, tiendas distintas, última visita, **tiendas ordenadas por tickets** de fidelización, últimos movimientos.

## Endpoints (`/api/v1/admin/reportes/`)
`resumen/` · `usuarios-por-rol/` · `visitas-por-dia/` · `compras-por-dia/` · `horas-pico/` · `dias-semana/` · `empresas/ranking/` · `empresas/sin-actividad/` · `clientes/frecuentes/` · `clientes/dormidos/` · `clientes/{id}/historial/`
Todos aceptan `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`.

## Diseño
- Paleta validada para daltonismo (azul `#2a78d6` visitas, naranja `#eb6834` compras), modo claro y oscuro.
- Los rechazados no cuentan como tickets. Las oficinas no aparecen en el ranking (no tienen caja).

## Decisiones tomables
Horas pico → reforzar seguridad/eventos · clientes dormidos → promoción · tiendas sin actividad → visibilidad · días flojos → puntos dobles.

## Pendiente

### Fidelización Wallet — alcance acordado 2026-11-17

Pendiente de implementación. El admin tendrá una lista de participantes con nombres, apellidos,
correo, celular, puntos, participaciones, monto aprobado y última actividad; búsqueda, filtros y ranking
ordenable por puntos, monto o compras. Al pulsar un participante abrirá su ficha e historial completo.
Cada compra permitirá ver la imagen PNG/JPG de la factura y su texto OCR, los datos registrados,
el negocio y operador que aprobó, fechas y auditoría. El OCR debe mostrar su estado y conservar
el original al corregirse; no modifica automáticamente el monto aprobado. Acceso a imágenes y datos protegido.
El negocio sigue aprobando sus propias compras; el admin supervisa. Especificación y criterios:
`docs/FIDELIZACION_EQUIPO.md`.

Oficinas (invitados), promociones, eventos, exportar Excel/PDF, pantallas de porteros/recompensas/configuración. Ver [[Mapa de módulos]].
