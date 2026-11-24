# Datos de la vista administrativa

## Fuente actual

El proveedor `proveedor.ts` carga `datosDemo.ts` solo durante desarrollo local. Fuera de desarrollo responde que el servicio no está disponible; los datos ficticios no se usan como fallback silencioso ante errores de API.

## Consulta del ranking

La búsqueda se aplica al enviar el formulario y admite varias palabras, tildes y números de teléfono o códigos sin separadores. Campaña, orden y filtros se conservan en la URL; al cambiar un filtro se vuelve a la primera página.

Local y fechas deben coincidir en una misma compra de la campaña del participante. El periodo incluye ambos extremos y acepta una sola fecha. Los rangos invertidos y las fechas inválidas se rechazan. Los saldos del ranking representan toda la campaña; el monto mostrado con filtros de local o fecha cuenta únicamente compras aprobadas que coinciden con esos filtros.

## Historial y comprobante

El historial agrega su propio estado y usa parámetros `historial*`, separados de la búsqueda del ranking. Al regresar desde una ficha o comprobante se conserva la consulta de la lista.

Los fixtures incluyen ejemplos de lectura OCR completada con texto, completada sin texto, en proceso y fallida. La imagen se dibuja localmente para la demostración; no hay una foto real ni procesamiento OCR. Los estados de compra de los fixtures tampoco implementan acciones reales para aprobar, rechazar o devolver.

## Conectar el backend

Reemplazar el contenido del proveedor por consultas reales manteniendo estados explícitos para datos disponibles, participante/comprobante no encontrados y servicio no disponible. Los filtros y contratos de API deben acordarse con backend; los fixtures no definen esos contratos ni reglas finales de estados.
