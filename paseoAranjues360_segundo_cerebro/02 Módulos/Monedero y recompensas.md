---
tags: [modulos, app, recompensas]
---

# Monedero y recompensas

## Monedero (arriba en el inicio de la app)
- 🪙 Tres **monedas doradas con "P"** que caen una tras otra; el saldo cuenta desde 0.
- **Barra de progreso** dorada hacia la siguiente recompensa (mide el tramo desde la última alcanzada, no desde 0).
- *"Te faltan **84 pts** para **Capuchino gratis**"*
- *"≈ Bs 84 en compras · o sigue sumando con tus visitas"* (Bs según la regla vigente, redondeo hacia arriba).
- Etiqueta **"🎁 N para canjear"** si ya alcanza recompensas.
- Debajo, cuadrícula de módulos (Mi QR, Sumar compra, Recompensas, Historial, Tiendas, Asistente) marcados "Pronto" hasta implementarlos.

Endpoint: `GET /api/v1/puntos/monedero/` → `{ saldo, recompensas_disponibles, siguiente: { nombre, costo_puntos, faltan_puntos, faltan_bs, progreso } }`

## Catálogo de recompensas (ejemplos del PDF)
| Puntos | Recompensa |
|---|---|
| 300 | Cupón 10% de descuento |
| 500 | Capuchino gratis (Café Aranjuez) |
| 700 | Producto promocional del Paseo |
| 1000 | Bs 50 de descuento en tiendas participantes |
| 1500 | Acceso a promoción exclusiva |

- El admin las administra (`admin/recompensas/`); pueden ser de todo el Paseo o de una empresa.
- La app lista solo las activas (`puntos/recompensas/`).

## Canje
- ✅ Backend: el cliente canjea (`puntos/canjes/`) → se descuentan las monedas → cupón con código → el negocio lo valida (`canjes/validar/<codigo>/`, `mi-empresa/canjes/`). Jarvis también canjea con confirmación.
- ⏳ Falta la **pantalla Beneficios** en la app (hoy la pestaña solo baja al monedero). Ver [[Pendientes]].

Archivos: `app/components/Monedero.js`, `app/screens/HomeScreen.js`, `backend/fidelizacion/services.py` (`monedero`)
