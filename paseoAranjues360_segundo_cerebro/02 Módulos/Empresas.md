---
tags: [modulos, empresas]
---

# Empresas

Tipos: **Negocio**, **Emprendimiento**, **Oficina** (alquila y brinda servicios aparte, sin caja de puntos).

## Alta (lo hace el admin)
1. El admin registra: nombre, tipo, categoría, correo del responsable, teléfono.
2. El sistema crea la cuenta del responsable (rol `NEGOCIO` u `OFICINA`), genera una **contraseña temporal** y la **envía por correo**.
3. La empresa entra a la web, **cambia la contraseña** y completa su ficha.
4. El admin puede **reenviar acceso** (nueva contraseña temporal) o **desactivar** la empresa. Las empresas no se borran.

## Ficha (la llena la empresa)
- Logo (imagen), descripción, **piso**, **local**, referencia (cómo llegar), teléfono.
- **Horarios** por día de la semana (abre, cierra o cerrado).
- **Productos**: foto, nombre, precio (Bs), descripción, activo.
- **Ofertas**: título, producto opcional, precio de oferta, imagen, fecha inicio/fin.
- Nombre, tipo y correo solo los cambia el admin.
- "Ficha completa" = tiene logo, piso, local y horarios.

## QR / NFC de caja
- Cada negocio/emprendimiento tiene un **código propio** (`codigo_fidelizacion`).
- Va en el QR impreso y en el sticker NFC: `paseo360://puntos/<codigo>` (abre la app).
- **Regenerable** si alguien fotografía el QR y lo usa mal.
- Las oficinas **no** tienen QR de caja.
Uso del QR → [[Fidelización]]

## Directorio público
La app y la web muestran solo empresas **activas**, con horarios, productos activos y ofertas vigentes.

## Archivos clave
`backend/empresas/` (models, services, views) · `web/src/pages/Empresas.jsx`

Directorio organizado por tipo y rubro, con las 70 tiendas reales → [[Directorio y rubros]] · Menús y pedidos → [[Comer y pedidos (PaseoYa)]]
