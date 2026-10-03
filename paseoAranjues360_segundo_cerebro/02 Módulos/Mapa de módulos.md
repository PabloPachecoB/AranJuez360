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
| Configuración de puntos | 🟡 | API `admin/configuracion-puntos/` |
| Recompensas | 🟡 | API `admin/recompensas/` |
| Eventos y promociones | ⏳ | |
| Oficinas: visitas | ⏳ | [[Oficinas e invitaciones]] |
| Exportar Excel/PDF | ⏳ | |

## 🏪 Web — panel de la empresa
| Módulo | Estado |
|---|---|
| Mi ficha (logo, piso, local, referencia) | 🟡 |
| Horarios | 🟡 |
| Productos y ofertas | 🟡 |
| Mi QR/NFC de caja | 🟡 |
| Caja: aprobar/rechazar solicitudes | 🟡 |
| Validar canjes | ⏳ |
| Mis cajeros | ⏳ |
| Invitaciones QR (oficinas) | ⏳ |
| Pedidos PaseoYa (avanzar, cancelar, validar retiro) | ✅ `web/src/empleado/pages/PedidosPage.tsx` |

## 📱 App — cliente
| Módulo | Estado |
|---|---|
| Registro, verificación de correo, login con código, huella | ✅ |
| Monedero (monedas, progreso, cuánto falta) | ✅ [[Monedero y recompensas]] |
| Mi QR (portería) | 🟡 |
| Sumar compra (escanear QR/NFC de caja) | 🟡 |
| Historial de puntos | 🟡 |
| Recompensas y canje | 🟡 catálogo · ⏳ canje |
| Directorio de tiendas y ofertas (lista, por piso, ficha con galería) | ✅ [[Directorio y rubros]] |
| Comer: menús, carrito, pedido con código, mis pedidos | ✅ [[Comer y pedidos (PaseoYa)]] |
| Diversión: cartelera y eventos reales | ✅ [[Diversión (cartelera y eventos)]] |
| Asistente IA (Jarvis) con datos reales y fichas | ✅ [[Jarvis (asistente IA)]] |
| Notificaciones push (pedido listo) | ⏳ |

## 📱 App — portero
| Módulo | Estado |
|---|---|
| Escáner: registrar visita del cliente | 🟡 |
| Escáner: validar invitación de oficina | ⏳ |

Siguiente paso recomendado → [[Pendientes]]
