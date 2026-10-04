# Mapa de clientes del Paseo

En **Administración → Inicio**, el bloque «De dónde vienen tus clientes» usa
`GET /api/v1/admin/reportes/clientes/mapa/?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`.
Solo el rol ADMIN puede consultarlo. No devuelve nombres, domicilios ni fechas
de nacimiento individuales.

## Datos y significado

- La app ya recoge `procedencia` (16 provincias de Cochabamba u OTRO),
  `ciudad_otra` y `fecha_nacimiento`. Se reutilizan sin migrar datos.
- Clientes = todas las cuentas CLIENTE registradas actualmente, también las que
  no compraron. El periodo solo filtra compras y visitas.
- Consumo = suma de tickets de fidelización APROBADOS creados en el periodo,
  no todas las ventas de los negocios. No incluye pendientes ni rechazados.
- Gasto por comprador = consumo dividido entre clientes distintos con compras
  aprobadas. Cada comprador se cuenta una vez aunque tenga varios tickets.
- Al seleccionar una provincia aparece una ficha con icono de personas, cantidad,
  edad promedio, ocupación predominante, frecuencia y puntos. En móvil aparece
  junto al mapa sin tapar las provincias.
- Ocupación usa las categorías declaradas en la app (colegio, universidad,
  profesional, otro); no se infiere una profesión concreta.
- Puntos disponibles = suma del saldo actual `puntos_saldo`. Puntos ganados = suma
  de movimientos positivos del periodo, incluyendo compras, visitas y actividades.
  No se suman saldos ficticios ni se modifica el monedero al consultar el mapa.
- Compradores recurrentes = clientes con al menos dos compras aprobadas en el
  periodo. La frecuencia media suma, por comprador recurrente, el tiempo entre
  su primera y última compra y lo divide entre el total de intervalos (compras
  menos una). Los compradores de una sola compra no aportan intervalos. Sin
  repetición se informa «Sin compras repetidas», nunca una frecuencia inventada.
- Los puntos de cuentas de demostración existentes se incluyen igual que los de
  cualquier cuenta CLIENTE; este informe no crea ni regenera usuarios de prueba.
- Edades = años cumplidos a la fecha de consulta, agrupados. Las fechas ausentes,
  futuras o con más de 110 años aparecen como «Sin dato».
- Las ciudades se agrupan sin distinguir mayúsculas, tildes o espacios repetidos.
  No se unifican abreviaturas ni homónimos de diferentes países; el formulario
  pide el nombre completo. Las ciudades no tienen coordenadas en este mapa.
- No se usa GPS. Una provincia es una región agregada; la intensidad no representa
  densidad por km², direcciones particulares ni presencia en tiempo real.
- Las provincias sin clientes aparecen en gris. Si el periodo no tiene compras,
  el modo consumo muestra cero. Los clientes sin procedencia se muestran aparte.

## Cartografía

Datos GeoBolivia, publicados por geoBoundaries, dominio público; límites de
referencia de 2015, versión `9469f09`, BOL ADM2.

- Metadatos y licencia: https://www.geoboundaries.org/api/current/gbOpen/BOL/ADM2/
- Fuente: https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/BOL/ADM2/geoBoundaries-BOL-ADM2_simplified.geojson
- Generador: `python scripts/build_cochabamba_map.py archivo_geojson`
- Salida: `web/src/admin/data/cochabamba.json` (16 provincias, SVG local).

La fuente reúne todas las provincias llamadas Cercado en un MultiPolygon. El
generador conserva únicamente el polígono de Cochabamba. Se ajustan los nombres
Campero → Narciso Campero y Esteban Arze → código existente ESTEBAN_ARCE.
La proyección local ajusta longitudes por el coseno de la latitud central.
La aplicación no necesita servicios cartográficos ni claves en ejecución.

## Comprobaciones

`python manage.py test reportes.test_geografia --noinput` desde backend.
`npm run build` desde web.

El selector de procedencia de la app incluye las 16 provincias incluso si no
puede cargar las opciones del backend; «Otro lugar» pide ciudad (máximo 80 caracteres).
