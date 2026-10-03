---
tags: [modulos, paseoya, pedidos, app, web]
actualizado: 2026-10-03
---

# Comer y pedidos (PaseoYa)

Marketplace de comidas: el cliente ve los menús, pide desde la app y **recoge en el local** con un código (no hay delivery).

## Flujo completo (probado 2026-10-03)
1. **App (cliente)** → sección **Comer**: elige platos → carrito → "Pedir".
2. Se crea el pedido con **código de retiro** (ej. `9C05380D`). Regla: **un pedido = un solo local**.
3. **Web (negocio)** → `web/src/empleado/pages/PedidosPage.tsx`: ve el pedido entrante y lo avanza.
4. Estados: Recibido → Confirmado → Preparando → **Listo para recoger** → Entregado (o Cancelado).
5. En el local, el negocio **valida el código** y el pedido pasa a Entregado.
6. La app refleja cada cambio: "Mis pedidos" se actualiza cada 15 s mientras haya pedidos en curso, y el **Inicio** muestra una tarjeta del pedido (verde cuando está listo).

> Prueba real: Waffle King (`demo.waffleking@paseo.bo`), Bs 64 → Confirmado → Preparando → Listo → Entregado. ✅

## Menús de los 23 restaurantes
- **93 platos** cargados desde `backend/empresas/datos/menus_paseo.json`.
- Los platos salen del rubro que cada local publica en paseoaranjuez.com.
- ⚠️ **Precios referenciales** (no publicados por los locales): calibrados con almuerzo con bebida ≈ Bs 51 y cerveza ≈ Bs 18 en Cochabamba (expatistan.com). Cada negocio los corrige desde su panel.
- Fotos: 49 platos usan fotos reales de la galería del local (repartidas por turnos, **no es la foto del plato exacto**); el resto muestra el logo.

```bash
python manage.py cargar_menus_paseo   # después de importar_tiendas_paseo
```

## En la app (`ComerScreen`)
- Carrusel de logos para filtrar por local · buscador · grilla con foto, local, piso y precio.
- Primero los platos con foto real.
- Carrito por local; si agregas de otro local pregunta si vaciar.
- Pestaña **Mis pedidos** con estado y código.

## API
| Ruta | Quién | Uso |
|---|---|---|
| `GET /api/v1/productos/?rubro=comida&empresa=&buscar=` | público | catálogo con logo y piso del local |
| `POST /api/v1/pedidos/` `{empresa, items:[{producto_id, cantidad}]}` | cliente | crear pedido |
| `GET /api/v1/pedidos/` | cliente | mis pedidos |
| `GET /api/v1/mi-empresa/pedidos/` · `avanzar/` · `cancelar/` · `validar-retiro/` | negocio (web) | panel |

## Pendiente
- Notificación push cuando el pedido está listo (hoy solo se entera con la app abierta).
- Fotos reales por plato (las sube cada negocio).

## Archivos clave
`backend/pedidos/` · `backend/empresas/views.py` (`ProductoPublicoViewSet`) · `app/screens/ComerScreen.js` · `app/services/pedidosService.js` · `web/src/empleado/api/pedidos.ts`

Relacionado: [[Directorio y rubros]] · [[Jarvis (asistente IA)]] · [[Decisiones]]
