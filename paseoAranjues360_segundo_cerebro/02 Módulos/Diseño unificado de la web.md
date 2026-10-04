---
tags: [web, diseño, marca]
actualizado: 2026-10-04
---

# Diseño unificado de la web

Hasta 2026-10-04 la web tenía **tres looks**: negocios en terracota (herencia de PaseoYa), administración en azul marino y los módulos Paseo 360 / oficinas en grises con azul y modo oscuro automático. Ahora todo usa **una sola paleta: azul marino + dorado de Stitch**, la misma de la app y del logo.

## Dónde vive el diseño (cambiar aquí cambia todo)
| Archivo | Qué controla |
|---|---|
| `web/src/index.css` (`@theme`) | Colores y tipografía globales → panel de **negocios y emprendimientos**, login, clientes |
| `web/src/admin/admin-theme.css` | Mismos valores, para `.admin-shell` (sidebar oscuro del admin) |
| `web/src/paseo360/estilos.css` (`.p360`) | Módulos del admin (Diversión, Escenario, Monedas, Invitaciones, Pedidos), panel de **oficinas**, cajero, mini-sitio |

## Reglas
- Colores: primario `#00324b`, secundario `#1c6586`, dorado `#daa520` / `#f6be3b`, fondo `#f7f9ff`. Los estados verde/rojo se mantienen.
- Tipografía: títulos **Manrope**, texto **Inter**.
- Tarjetas redondeadas (16 px), botones azules, tablas con encabezado en mayúsculas pequeñas, filtros en píldora.
- Siempre claro (se quitó el modo oscuro automático de `.p360`).
- El panel de **oficinas** tiene ahora el mismo menú que el de negocios (marca, tarjeta con piso y local, íconos, activo en azul).
- No se cambió ninguna lógica.

## Pendiente de revisar con Codex
`AdminSidebar.tsx` aún muestra "Paseo Aranjuez / Panel administrativo" con el logo viejo, mientras negocios y oficinas dicen "Paseo Aranjuez 360". No se tocó para no chocar con el trabajo del mapa/recepción.

Relacionado: [[Roles]] · [[Dashboard admin]] · [[Logo y animación de entrada]]
