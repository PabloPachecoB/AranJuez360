---
tags: [modulos, estado]
actualizado: 2026-10-03
---

# Mapa de módulos

✅ hecho · 🟡 backend listo, falta pantalla · ⏳ pendiente

## 🖥️ Web — administración
| Módulo | Estado | Nota |
|---|---|---|
| Login con doble autenticación | ✅ | [[Registro y acceso]] |
| Inicio / dashboard | ✅ | [[Dashboard admin]] |
| Usuarios (rol, correo, estado, último ingreso) | ✅ | activar/desactivar |
| Empresas (alta + credenciales por correo) | ✅ | [[Empresas]] |
| Historial por cliente | ✅ | tiendas con más tickets |
| Porteros | 🟡 | API `admin/porteros/` |
| Configuración de puntos | 🟡 | API `admin/configuracion-puntos/` (revisar `Monedas.jsx`) |
| Recompensas | 🟡 | API `admin/recompensas/` |
| Pedidos y retiros (supervisión de PaseoYa) | ✅ | `PedidosAdmin.jsx` → [[Comer y pedidos (PaseoYa)]] |
| Cartelera y eventos | ✅ | `paseo360/pages/Diversion.jsx` (películas, funciones, eventos con cupos y espacio) |
| Escenario abierto: aprobar solicitudes y espacios | ✅ | `/escenario` → [[Escenario abierto]] |
| Promociones del Paseo | ⏳ | hoy solo ofertas de cada negocio |
| Oficinas: visitas | 🟡 | API lista → [[Oficinas e invitaciones]] |
| Exportar a Excel | ✅ | Reportes (CSV que abre Excel); PDF pendiente |

### Menú del administrador (todas las opciones funcionan, 2026-10-04)
| Opción | Qué hace |
|---|---|
| Categorías | Rubros del directorio (alta, edición, baja) |
| Representantes | Responsables de cada negocio/oficina: contacto, último ingreso, reenviar acceso, activar/desactivar |
| Equipo del Paseo | Porteros: crear (reciben la clave por correo), editar, desactivar, reenviar acceso |
| Reportes | Descarga CSV/Excel: pedidos, actividad por negocio, clientes activos, perfil, procedencia, auditoría |
| Auditoría | Línea de tiempo de pedidos, compras, canjes, visitas, Escenario, invitaciones y registros, con quién lo hizo |
| Configuración | Reglas de las monedas (valor, visitas, límites) |
Se quitó **Jarvis** del menú.

## 🏪 Web — panel de la empresa
| Módulo | Estado |
|---|---|
| Mi ficha (logo, piso, local, referencia) | ✅ `web/src/paseo360/empresa/MiFicha.jsx` |
| Horarios | ✅ `Horarios.jsx` |
| Productos y ofertas | ✅ `Catalogo.jsx` |
| Mi QR/NFC de caja | ✅ `MiQR.jsx` |
| Caja: aprobar/rechazar solicitudes | ✅ `Caja.jsx` · `CajeroApp.jsx` |
| Recompensas propias y validar canjes | ✅ `Recompensas.jsx` |
| Mis cajeros (crear/desactivar) | ⏳ no hay API: hoy se crean desde el admin de Django |
| Visitas (oficinas) | ✅ `Visitas.jsx` |
| Pedidos PaseoYa (avanzar, cancelar, validar retiro) | ✅ `web/src/empleado/pages/PedidosPage.tsx` |

## 📱 App — cliente
| Módulo | Estado |
|---|---|
| Registro, verificación de correo, login con código, huella | ✅ |
| Monedero (monedas, progreso, cuánto falta) | ✅ [[Monedero y recompensas]] |
| Login con animación de entrada (torres → logo 360) | ✅ [[Logo y animación de entrada]] |
| Mi QR (portería) | 🟡 decidir si sigue o lo reemplaza el NFC de la puerta |
| Sumar compra / visita (escanear QR/NFC) | ✅ `EscanearScreen` |
| Historial de puntos | ⏳ API lista, falta pantalla |
| Beneficios: catálogo, canje, mis cupones | ⏳ API lista, falta pantalla |
| Oficinas: agendar visita | ✅ `OficinasScreen` |
| Directorio de tiendas y ofertas (lista, por piso, ficha con galería) | ✅ [[Directorio y rubros]] |
| Comer: menús, carrito, pedido con código, mis pedidos | ✅ [[Comer y pedidos (PaseoYa)]] |
| Diversión: cartelera con pósters, eventos con detalle | ✅ [[Diversión (cartelera y eventos)]] |
| Escenario abierto: proponer, reservar cupos, entrada con QR | ✅ [[Escenario abierto]] |
| Asistente IA (Jarvis) con datos reales y fichas | ✅ [[Jarvis (asistente IA)]] |
| Notificaciones push (pedido listo) | ⏳ |

## 📱 App — portero
| Módulo | Estado |
|---|---|
| Escáner: registrar visita del cliente | ✅ `PorteriaScreen` |
| Escáner: validar invitación de oficina | ✅ API `porteria/invitaciones/` |
| Escáner: entrada a evento con cupos | ✅ `paseo360://evento/<código>` |

Siguiente paso recomendado → [[Pendientes]]
