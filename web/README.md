# Web negocio y admin (React + Vite)

Panel web para negocios y administrador, compartido por los 3 módulos.

## Panel del negocio (rama `brenda-explorar`)

- **Mis productos:** crear, editar, borrar, foto, precio, stock, visible/oculto.
- **Mi local:** logo, categoría, descripción, piso, local, cómo llegar, horario, fotos del local, WhatsApp/Instagram/Facebook, con vista previa de la tarjeta que verá el cliente.
- **Promociones:** poner o quitar promoción con precio especial (atajos -10/-20/-30/-50%).

Los datos viven en `localStorage` (`src/api/db.ts`) con los nombres de `docs/BASE_PROYECTO_PASEO.md` sección 4. Cuando exista el backend, solo hay que reemplazar el cuerpo de esas funciones por llamadas a las rutas de la sección 6.

**Propuesta pendiente de aprobar por el equipo:** campos nuevos en `negocios`: `fotos_local`, `facebook`, `instagram`, `whatsapp`.

## Ejecutar

```bash
cd web
npm install
npm run dev
```

Pendiente: login, pedidos entrantes y escaneo de QR (Persona 2).
