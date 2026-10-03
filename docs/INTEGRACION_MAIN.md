# Integración de main con Paseo Points

Base integrada: origin/main 30ed7aa sobre codex/paseo-points-prototipo ba34d6c.

## Resultado

- Se conservan Jarvis, voz, oficinas, entretenimiento, páginas públicas de empresas, NFC/QR y rangos de compra de main.
- Saldo, movimientos y costos de recompensas utilizan monedas con dos decimales.
- Recompensa usa empresa como campo común. La API /recompensas/ conserva negocio_id como alias compatible con la web Points.
- Canje (contrato de la app/Jarvis) y Cupon (contrato web/caja) representan la misma operación mediante una relación única. Emitir descuenta una sola vez; validar sincroniza ambos estados.
- Las condiciones del cupón emitido quedan fijas. Cambiar el catálogo no cambia el beneficio que ya obtuvo el cliente.
- Los beneficios globales de main los valida administración; los negocios solo validan sus propios cupones.
- Los negocios conservan su panel completo y tienen una sección Validar beneficios. Administración conserva Monedas y Diversión y añade Paseo Points.
- Se mantiene el acceso directo con correo y contraseña solicitado por Jorge. El registro nuevo conserva el flujo de verificación de correo de main.
- Los pedidos entregados suman monedas con las reglas/rangos vigentes y un movimiento único por pedido.

## Migraciones y datos existentes

Ambas ramas publicaron una migración 0003 que crea Recompensa. Las dos operaciones usan ahora CreateSharedRecompensa: si la tabla existe, agregan únicamente los campos faltantes. No se alteraron sus dependencias ni se requiere --fake.

0006 une ambos historiales. 0007 copia negocio a empresa, adapta los decimales y vincula los canjes/cupones existentes conservando código, estado, fecha y saldo. Para canjes antiguos de main, movimiento puede quedar vacío en el cupón porque el débito histórico ya existe y no se inventa un segundo movimiento.

La operación de creación compartida no admite deshacer borrando la tabla: para revertir datos, usar copia de respaldo. Las pruebas de migración cubren SQLite; falta verificar estas migraciones en PostgreSQL antes de despliegue.

Desde la raíz del repositorio:

```powershell
$env:DEBUG="True"
$env:USE_LOCAL_DB="True"
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe scripts\verificar_migraciones_points.py
```

Las pruebas de migración utilizan bases temporales; no modifican la base de desarrollo. Para Expo, ejecutar npm ci dentro de app: main añadió dependencias móviles.

## Compatibilidad de API

POST /recompensas/{id}/canjear/ exige clave_operacion UUID. POST /puntos/recompensas/{id}/canjear/ admite la misma clave opcional para compatibilidad con clientes existentes. Un reintento debe conservarla; sin ella, dos peticiones se consideran dos compras distintas. Jarvis conserva su confirmación explícita antes de ejecutar acciones.

No se fusionó esta rama en main. La integración corresponde al commit 30ed7aa; futuros cambios de main necesitan una nueva revisión.
