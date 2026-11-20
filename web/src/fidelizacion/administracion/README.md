# Administración de Fidelización

Esta carpeta contiene exclusivamente la vista administrativa de Fidelización: ranking de participantes, ficha e historial de compras y visor de comprobantes. Las páginas públicas de registro y tarjeta permanecen en la raíz de `fidelizacion/`.

## Estructura

- `pages/`: pantallas que conectan rutas, estado de consulta y presentación.
- `components/`: secciones visuales reutilizables dentro del área administrativa, como ranking, filtros e historial.
- `datos/`: tipos de consulta, filtros, proveedor de datos y fixtures de desarrollo.

`datos/consulta.ts` concentra búsqueda, ordenamiento, paginación y filtros. `datos/proveedor.ts` es el punto de entrada de las pantallas para cargar información; hoy entrega fixtures en desarrollo y declara el servicio no disponible en producción. `datos/datosDemo.ts` contiene ejemplos ficticios y no representa un contrato del backend. Las reglas de consulta y los límites de la simulación están en [`datos/README.md`](datos/README.md).

La lista de participantes está en `/fidelizacion`. La ficha se abre en `/fidelizacion/participantes/:id` y el comprobante en `/fidelizacion/participantes/:id/compras/:compraId`.

La búsqueda se aplica con **Buscar** o Enter y conserva los filtros en la URL. Los filtros del historial usan parámetros separados para que regresar a la lista mantenga su consulta original.
