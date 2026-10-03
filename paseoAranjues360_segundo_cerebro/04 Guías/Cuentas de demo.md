---
tags: [guia, demo]
---

# Cuentas de demo

> Contraseña de todas: **`Paseo2026!`** (solo entorno local de desarrollo)

| Rol | Correo | Dónde entra |
|---|---|---|
| Admin | `admin@paseo.bo` | Web (3000) y Django admin |
| Cliente | `cliente@paseo.bo` | App (8082) — 416 puntos, le faltan 84 para Capuchino gratis |
| Portero | `portero@paseo.bo` | App (modo portero, pendiente) |
| Negocio | `cafearanjuez@paseo.bo` | Web (panel empresa, pendiente) |
| Emprendimiento | `dulcehogar@paseo.bo` | Web |
| Oficina | `estudiolegalandino@paseo.bo` | Web |
| Cajero | `caja.cafe@paseo.bo` | Web (caja, pendiente) |

## Empresas de demo
Café Aranjuez, Burger Paseo, TecnoPlus, Moda Urbana (negocios) · Dulce Hogar (emprendimiento) · Estudio Legal Andino (oficina). Todas con horarios y productos.

## Actividad ficticia
`cargar_actividad_demo --dias 60 --clientes 45` → ~550 visitas y ~370 compras, con horas pico (13h y 19h) y más movimiento el fin de semana. Los clientes ficticios son `clienteN@demo.paseo.bo` (sin contraseña utilizable).

## Recompensas
300 · 500 · 700 · 1000 · 1500 puntos → [[Monedero y recompensas]]

## Tiendas reales (2026-10-03)
- 69 cuentas `demo.<nombre>@paseo.bo` con rol Negocio, misma contraseña. Lista completa: `docs/ACCESOS_DEMO_TIENDAS.csv` (solo local, no se sube a GitHub).
- Ejemplos: `demo.brochetaking@paseo.bo`, `demo.waffleking@paseo.bo` (probada con pedidos).
- **HOY HAY** no tiene cuenta.
- El código de doble autenticación aparece en la terminal del backend local.

## Cargar todos los datos reales
```bash
python manage.py cargar_demo              # cuentas base + agenda real (retira lo ficticio)
python manage.py importar_tiendas_paseo   # 70 tiendas con logos y fotos
python manage.py organizar_rubros
python manage.py cargar_menus_paseo       # 93 platos
python manage.py importar_agenda_paseo    # cartelera y eventos
```
→ [[Directorio y rubros]] · [[Comer y pedidos (PaseoYa)]] · [[Diversión (cartelera y eventos)]]
