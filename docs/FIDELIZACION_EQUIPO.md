# Fidelización Wallet: guía de trabajo del equipo

Actualizado: 2026-11-17. Este documento define el trabajo pendiente; no certifica que el módulo ya funcione.

## Decisión vigente

Trabajamos en el mismo repositorio AranJuez360 para compartir autenticación, permisos y panel de negocios.
Cada negocio escanea la Wallet, identifica al cliente, verifica el comprobante y aprueba su propia compra.
Esto sustituye la propuesta del 13 de noviembre de aprobación obligatoria por un validador del mall.
El admin del Paseo administra campañas, supervisa, audita y resuelve excepciones y devoluciones.

Cada Bs 200 acumulados en compras aprobadas de locales participantes equivale a 1 punto y 1 participación.
El sobrante se conserva entre compras y locales de la campaña. Los puntos del sorteo son independientes
de las monedas y recompensas actuales de Paseo Points; no cambiar sus reglas ni reutilizar su saldo.

## Ramas y colaboración

| Rama | Trabajo |
|---|---|
| `integracion-equipo` | Base común e integración mediante pull requests |
| `feature/fidelizacion-frontend` | Escaneo, formulario, historial y pantallas de Wallet |
| `feature/fidelizacion-backend` | Cuentas, campañas, compras, aprobación, auditoría y Wallet |

Las dos ramas parten del mismo commit de organización. No trabajar sobre `main` ni subir secretos.
Antes de empezar, con un directorio de trabajo limpio:

```sh
git fetch origin
git switch --track origin/feature/fidelizacion-frontend
```

Para backend, sustituir la última rama por `origin/feature/fidelizacion-backend`.
Si la rama ya existe localmente, usar `git switch feature/fidelizacion-frontend` (o backend).
Actualizar desde `origin/integracion-equipo` con merge, sin force push sobre ramas compartidas.
Abrir PR hacia `integracion-equipo` con alcance, capturas si hay UI y pruebas realizadas.
Coordinar cambios en archivos compartidos como `web/src/App.tsx` y este documento antes de editarlos.

## Qué existe y dónde trabajar

| Área | Ubicación y estado |
|---|---|
| Panel de negocios actual | `web/src/empleado/`, integrado por `web/src/App.tsx` para el rol NEGOCIO |
| Panel de cajero actual | `web/src/paseo360/empresa/CajeroApp.jsx` y `Caja.jsx` |
| Panel de oficinas | `web/src/paseo360/empresa/EmpresaApp.jsx`; no es la entrada actual de NEGOCIO |
| Admin | `web/src/admin/` |
| Backend existente | `backend/fidelizacion/`; las rutas de puntos actuales no implementan el nuevo sorteo |
| Google Wallet | `wallet_google.py`, `wallet_banner.py`, `test_wallet_google.py` dentro de fidelizacion |
| Pruebas del panel | `e2e/`; instrucciones en `e2e/README.md` |

Google Wallet tiene una prueba real documentada y generación de banner. Falta conectar las compras reales,
su aprobación y actualización del pase. Apple Wallet sigue pendiente de cuenta/certificados e implementación.

## Flujo a implementar

1. Negocio o cajero autenticado abre «Fidelización» y escanea el QR del pase; ofrecer ingreso manual del código.
2. El backend resuelve el código opaco y revocable. Mostrar primer nombre e iniciales del cliente.
3. Completar número de comprobante, monto en Bs y foto del ticket. Negocio, operador y fecha se obtienen en servidor.
4. Mostrar un resumen con cliente y monto, y la acción «Verificar y aprobar compra».
5. El negocio confirma que el ticket corresponde a una compra de su local. El backend registra la aprobación y acredita una sola vez.
6. Mostrar resultado, puntos y sobrante calculados por backend. Actualizar Wallet; si falla el proveedor,
   conservar la compra aprobada y reintentar la sincronización sin duplicar puntos.

Escanear el QR identifica al titular del pase; no demuestra por sí mismo que la compra sea real.

## Admin del Paseo: participantes, ranking y comprobantes

Alcance solicitado el 2026-11-17, pendiente de implementación. Incorporar una sección «Fidelización»
en el panel admin existente, con navegación lista → ficha del participante → detalle de compra.

### Lista y seguimiento

- Mostrar nombres, apellidos, correo y celular, con estado de verificación de cada contacto.
- Mostrar puntos, participaciones, monto aprobado acumulado, sobrante, cantidad de compras y última actividad.
- Orden inicial por puntos de mayor a menor; permitir ordenar también por monto aprobado, compras y última actividad.
- Buscar por nombre, apellido, correo, celular o código de tarjeta. Filtrar por campaña, local y periodo; paginar en servidor.
- Mostrar resumen de participantes, compras aprobadas, monto aprobado y puntos de la campaña seleccionada.
- El ranking se calcula con compras aprobadas netas de devoluciones, nunca con importes pendientes o rechazados.
  Indicar si los indicadores corresponden a la campaña completa o al periodo/local filtrado; el saldo del pase
  siempre corresponde a la campaña completa. Resolver empates de forma estable por identificador de participante.

### Ficha al hacer clic en una persona

- Cabecera con nombres, apellidos, correo, celular, código de tarjeta, fecha de registro y contactos verificados.
- Resumen de puntos, participaciones, monto aprobado, sobrante y monto faltante para el próximo punto.
- Historial paginado de compras: fecha, local, comprobante, monto, estado, operador que aprobó y fecha de aprobación.
- Incluir compras anuladas/devueltas y sus motivos, con acceso al historial de cambios. Mostrar por separado
  movimientos de puntos y compras: una compra menor a Bs 200 puede sumar solo sobrante.
- Al pulsar una compra, abrir su comprobante y auditoría sin perder los filtros de la lista.

### Imagen y texto de la factura

- Visor ampliable de la imagen del comprobante (PNG o JPG), conservando el archivo original y su relación con la compra.
- Mostrar junto a la imagen el texto extraído mediante OCR y los campos registrados: número/serie,
  fecha, monto y local. Identificar cuáles son datos del registro y cuáles fueron leídos de la imagen.
- Estados del OCR: pendiente, procesando, completado o fallido. Si falla o el documento es ilegible,
  mantener la imagen accesible y mostrar la incidencia; no inventar texto ni montos.
- Conservar el texto OCR original. Las correcciones manuales se guardan por separado con autor y fecha.
  La lectura automática no aprueba la compra ni modifica su monto aprobado; discrepancias requieren revisión.
- Proveedor/motor OCR por definir en backend. No prometer extracción infalible ni presentar esta función como existente.
- Solo ADMIN puede consultar la lista completa y contactos completos. El negocio conserva acceso a sus propias
  compras y comprobantes con los datos mínimos del cliente. Aplicar permisos también a archivos y texto OCR;
  no publicar facturas mediante URLs permanentes de libre acceso.

## Frontend: tareas

- Añadir acceso para NEGOCIO y CAJERO, escáner, permiso de cámara e ingreso manual.
- Crear formulario con validación, foto, resumen y aprobación explícita.
- Mostrar estados de carga, QR inválido/revocado, comprobante duplicado, permiso denegado y error de red.
- Historial limitado al local con detalle y estado de sincronización de Wallet.
- Admin: lista/ranking, búsqueda y filtros, ficha de participante, historial y visor de factura con texto OCR.
- Registro público y vista de progreso del cliente en una entrega posterior, coordinada con cuentas del backend.
- Reutilizar autenticación y diseño existentes; aislar el código nuevo en `web/src/fidelizacion/`.
- Mientras no exista API, usar datos simulados solo en desarrollo e indicar claramente la simulación.

## Backend: tareas

- Modelar campaña, cuenta independiente del cliente, compra, evidencia, movimientos y auditoría mediante migraciones.
- Resolver códigos de Wallet y validar permisos de negocio/cajero con empresa activa en cada operación.
- Implementar aprobación transaccional, acumulado en decimales, reversión auditada y sincronización reintentable.
- Evitar duplicados con restricciones en base de datos y claves de idempotencia para reintentos.
- Definir identidad de comprobante por local y serie/punto de emisión cuando corresponda; no depender del cliente
  como parte de la clave, ni bloquear por error números iguales de locales distintos.
- Guardar evidencia con acceso autenticado, operador y hora de aprobación; no permitir editar compras aprobadas directamente.
- Alertar sobre montos/frecuencia inusuales y concentración de compras; el admin puede investigar y corregir con trazabilidad.
- Registrar nombres, apellidos, correo y celular en la cuenta de fidelización; conservar verificación de contactos.
- API admin paginada para ranking, participantes y detalle/historial; agregados coherentes con filtros y devoluciones.
- Almacenamiento privado de comprobantes y proceso OCR reintentable; guardar texto original, estado y correcciones auditadas.

## Contrato de integración: primera entrega compartida

Antes de conectar pantallas, acordar y documentar rutas y ejemplos reales de petición/respuesta para:
resolver QR, registrar/aprobar compra, listar historial y consultar progreso del cliente.
Incluir para ADMIN: lista/ranking y resumen, ficha de participante, historial de compras, detalle del comprobante,
acceso autorizado a imagen y consulta del texto OCR con estado y correcciones. Acordar campos de paginación,
orden, filtros y alcance de los agregados. El contrato del negocio no debe exponer el directorio completo de clientes.
Estas rutas nuevas todavía no existen. Usar un espacio separado del API de puntos actual.

La resolución devuelve identificador interno y nombre reducido; la aprobación recibe referencia del cliente,
comprobante, monto decimal, evidencia y clave de idempotencia. Nunca confiar en empresa, operador o saldo enviados por navegador.
La respuesta incluye compra/estado, total aprobado, puntos, participaciones, sobrante, monto faltante y estado de sincronización.
Definir errores estables de QR inválido, duplicado, permisos, campaña inactiva y monto inválido.
Frontend y backend deben mantener los mismos ejemplos para simulación y pruebas de integración.

## Criterios de aceptación

- Bs 150 + Bs 80 aprobados, incluso en dos locales participantes: 1 punto, 1 participación y Bs 30 de sobrante.
- Reenviar el mismo comprobante o pulsar dos veces no duplica la compra ni los puntos, incluso en paralelo.
- El mismo comprobante no se puede adjudicar a otro cliente dentro del local y serie correspondientes.
- Un negocio no puede consultar, registrar ni aprobar compras de otro cambiando IDs en la API.
- QR revocado, monto inválido o campaña inactiva no acreditan puntos.
- Devolver la compra de Bs 80 del ejemplo deja Bs 150 y anula la participación, con auditoría.
- Fallar la actualización de Wallet no pierde la compra ni obliga a registrarla otra vez.
- Las monedas actuales de Paseo Points siguen funcionando igual.
- ADMIN puede buscar por contacto, ordenar participantes por puntos y abrir una ficha con nombres, apellidos,
  correo, celular e historial; la imagen y el texto corresponden exactamente a la compra seleccionada.
- Ranking y saldo reflejan devoluciones; filtros y paginación conservan totales coherentes y orden estable.
- OCR pendiente/fallido no impide revisar la imagen ni altera el monto aprobado. Correcciones conservan el original y auditoría.
- NEGOCIO/CAJERO no acceden al ranking global ni a comprobantes, texto OCR o contactos de otros locales manipulando IDs/URLs.

Validación por PR: frontend ejecuta `npm run build` en `web/` y prueba flujo móvil/cámara;
backend añade pruebas de permisos, cálculos, reversión e idempotencia (concurrencia en PostgreSQL).
Integración ejecuta las pruebas pertinentes de `e2e/` con API real y verifica el pase en dispositivo.
Crear las ramas y esta guía no equivale a implementar ni desplegar el módulo.
