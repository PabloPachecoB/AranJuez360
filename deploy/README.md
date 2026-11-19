# Despliegue en un VPS

El VPS usa un Caddy compartido como único servicio con puertos publicados (80/443).
Cada aplicación tiene su propio proyecto Compose. AranJuez360 conserva Django,
PostgreSQL, el panel React, archivos estáticos y media; su PostgreSQL y backend solo
son accesibles en la red privada de esa aplicación.

```text
Internet :80/:443 → Caddy compartido → Caddy interno de AranJuez360
                                               ├─ API → Django → PostgreSQL
                                               ├─ /static y /media
                                               └─ panel React
```

El Caddy compartido y solo el servicio web de cada aplicación se conectan a la red
Docker `proxy`. El Caddy interno sirve web, API y archivos. La base de datos no se
conecta a `proxy` ni publica puertos al host.

## Requisitos

- VPS con Ubuntu 22.04 o 24.04 y Docker Engine con Compose v2.
- Puertos 80 y 443 disponibles en el VPS. La configuración de firewall o de OCI se
  administra fuera de este despliegue.
- Un hostname por aplicación, con DNS A apuntando a la IP del VPS. La IP no se
  guarda en los archivos de la aplicación. Caddy obtiene HTTPS automáticamente.

## Prueba sin dominio con la IP reservada

En OCI, asigna la IP pública reservada a la VNIC del VPS. Para la prueba, `sslip.io`
resuelve un hostname que lleva esa IPv4 en sus etiquetas. Convierte los puntos en
guiones y añade `.sslip.io`: por ejemplo, la IP reservada `A.B.C.D` se escribe como
`A-B-C-D.sslip.io`. Usa la forma con guiones en el dominio raíz de `sslip.io`, que
es compatible con el certificado HTTPS automático de Caddy. [Documentación de
sslip.io](https://nip.io/).

En Ubuntu puedes formar y comprobar el hostname con la IP real asignada en OCI:

```bash
read -r -p 'IP pública reservada de OCI: ' VPS_IP
HOSTNAME="$(printf '%s' "$VPS_IP" | tr '.' '-').sslip.io"
printf 'Hostname: %s\n' "$HOSTNAME"
getent ahostsv4 "$HOSTNAME"
```

Comprueba que la última orden devuelve la IP reservada correcta. No uses IPs de
ejemplo o de documentación: el hostname debe contener la IP pública real de tu VPS.

Antes de iniciar el Caddy compartido, crea reglas de ingreso en la lista de
seguridad o NSG de OCI asociada a la VNIC:

| Protocolo | Puerto de destino | Origen | Requerido |
|---|---:|---|---|
| TCP | 80 | `0.0.0.0/0` | Sí |
| TCP | 443 | `0.0.0.0/0` | Sí |
| UDP | 443 | `0.0.0.0/0` | Opcional (HTTP/3) |

En `deploy/.env`, sustituye el hostname de ejemplo por el valor exacto de
`$HOSTNAME` en estas variables:

| Variable | Valor |
|---|---|
| `DOMINIO` | `A-B-C-D.sslip.io` |
| `ALLOWED_HOSTS` | `A-B-C-D.sslip.io` |
| `CSRF_TRUSTED_ORIGINS` | `https://A-B-C-D.sslip.io` |
| `CORS_ALLOWED_ORIGINS` | `https://A-B-C-D.sslip.io` |
| `WEB_PANEL_URL` | `https://A-B-C-D.sslip.io` |
| `PUBLIC_BASE_URL` | `https://A-B-C-D.sslip.io` |

Reemplaza cada `A-B-C-D` con los cuatro octetos de la IP reservada, unidos por
guiones (sin corchetes ni protocolo en `DOMINIO` y `ALLOWED_HOSTS`). En el archivo
`app/.env` del equipo donde ejecutas Expo, configura:

```dotenv
EXPO_PUBLIC_API_BASE=https://A-B-C-D.sslip.io
```

Usa el mismo hostname también al abrir el panel y al generar enlaces compartidos.
No cambies `USAR_HTTPS=True`.

## Primera instalación del VPS

Conéctate con el usuario `ubuntu`:

```bash
ssh ubuntu@IP_DEL_VPS
```

Si Docker todavía no está instalado, sigue las instrucciones oficiales de Docker
para Ubuntu. Clona el repositorio y prepara la red compartida una sola vez:

```bash
git clone https://github.com/PabloPachecoB/AranJuez360.git
cd AranJuez360/deploy
sudo docker network create proxy
cp .env.example .env
nano .env
```

En `deploy/.env`, configura `DOMINIO` con el hostname real (por ejemplo,
`aranjuez.midominio.com`) y sustituye las claves y contraseñas de ejemplo. Actualiza
también `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS`,
`WEB_PANEL_URL` y `PUBLIC_BASE_URL` para usar ese hostname. Genera `SECRET_KEY` con:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(50))'
```

No guardes `.env` en Git. Las claves de correo, Qwen y el proveedor de voz solo son necesarias
si se usan esas funciones.

Valida los dos archivos Compose antes de iniciar servicios. `config --quiet` valida
la configuración Compose (incluidas sus variables), pero **no analiza ni valida el
Caddyfile**:

```bash
sudo docker compose -f docker-compose.proxy.yml config --quiet
sudo docker compose -f docker-compose.yml config --quiet
```

Valida por separado el Caddyfile compartido, incluidos los sitios importados, antes
de iniciar el proxy. Este comando crea un contenedor temporal sin publicar puertos;
valida la configuración y sale sin iniciar el servidor:

```bash
sudo docker compose -f docker-compose.proxy.yml run --rm --no-deps caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Para validar el Caddyfile interno de la web después de construir su imagen, pero
antes de iniciar la aplicación:

```bash
sudo docker compose -f docker-compose.yml run --build --rm --no-deps web validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Si después cambias `DOMINIO`, actualiza también las variables de Django indicadas
arriba y aplica el cambio en ambos proyectos, desde `AranJuez360/deploy`:

```bash
sudo docker compose -f docker-compose.proxy.yml up -d
sudo docker compose -f docker-compose.yml up -d
```

## Iniciar AranJuez360

Desde `AranJuez360/deploy`, inicia primero el Caddy compartido y después la app:

```bash
sudo docker compose -f docker-compose.proxy.yml up -d
sudo docker compose -f docker-compose.yml up -d --build
sudo docker compose -f docker-compose.yml exec backend python manage.py cargar_demo
sudo docker compose -f docker-compose.yml exec backend python manage.py crear_admin tu-correo@gmail.com
```

Los dos últimos comandos son opcionales. Abre `https://aranjuez.midominio.com`.
Para las cuentas de demo, configura `CODIGOS_DEMO_EN_LOG=True` en `.env` y reinicia
solo la app con `sudo docker compose up -d` desde este directorio.

## Añadir otra aplicación de prueba

Cada app debe tener su propio Compose, sus volúmenes y su red privada. Publica solo
su servicio web en la red externa `proxy`, usando un alias Docker estable para que
el Caddy compartido pueda localizarlo. No publiques puertos en el host ni conectes
PostgreSQL, Redis u otros servicios internos a `proxy`.

La sección relevante del Compose de esa app tendrá esta forma:

```yaml
services:
  web:
    expose:
      - "80"
    networks:
      default: {}
      proxy:
        aliases:
          - app-prueba-web

networks:
  proxy:
    external: true
    name: proxy
```

Añade un archivo `proxy/sites/nombre-app.caddy` en el checkout que administra el
Caddy compartido, por ejemplo:

```caddyfile
prueba.midominio.com {
    reverse_proxy app-prueba-web:80
}
```

`app-prueba-web` debe ser un alias de red del servicio web de esa app. Luego inicia
la aplicación desde su propia carpeta y recarga la configuración compartida:

```bash
sudo docker compose up -d --build
cd ~/AranJuez360/deploy
sudo docker compose -f docker-compose.proxy.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Si el Caddy compartido se administra desde otro checkout/carpeta, ejecuta el
segundo comando allí con la ruta de su archivo Compose. El hostname debe resolver
al VPS antes de que Caddy pueda emitir un certificado.

## Actualizar AranJuez360

Desde `AranJuez360`:

```bash
git pull
cd deploy
sudo docker compose -f docker-compose.yml up -d --build
```

Esto actualiza únicamente AranJuez360. Si cambiaste `proxy/Caddyfile` o alguno de
`proxy/sites/*.caddy`, recarga Caddy por separado:

```bash
sudo docker compose -f docker-compose.proxy.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## Detener o retirar una aplicación

Desde la carpeta de la aplicación correspondiente, detén solo sus contenedores:

```bash
sudo docker compose down
```

Esto conserva sus volúmenes de PostgreSQL, media y datos, y no detiene otras apps
ni el proxy. Para retirarla por completo, primero elimina su archivo de sitio de
`proxy/sites/`, recarga el Caddy compartido y luego, desde el Compose de esa app:

```bash
sudo docker compose down -v
```

`-v` elimina permanentemente los datos de esa app; úsalo solo después de guardar
cualquier respaldo necesario. No ejecutes `down` para el Compose del Caddy al
retirar una aplicación.

## Comandos de operación

Desde `AranJuez360/deploy`:

```bash
sudo docker compose -f docker-compose.yml ps
sudo docker compose -f docker-compose.yml logs -f backend
sudo docker compose -f docker-compose.yml exec backend python manage.py shell
sudo docker compose -f docker-compose.yml down
```

Respaldo de PostgreSQL y media:

```bash
sudo docker compose -f docker-compose.yml exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > respaldo.sql
sudo docker run --rm -v aranjuez360_media:/m -v "$PWD":/b alpine tar czf /b/media.tgz -C /m .
```

La app móvil continúa en Expo. Configura `EXPO_PUBLIC_API_BASE` con el hostname,
por ejemplo `https://aranjuez.midominio.com`.

### Configurar Fish Audio en el VPS

Edita `AranJuez360/deploy/.env` (el archivo real, creado a partir de
`.env.example`) y configura:

| Variable | Valor que debes poner |
|---|---|
| `JARVIS_TTS_PROVIDER` | `fish_audio` |
| `FISH_AUDIO_API_KEY` | Tu clave privada de Fish Audio |
| `FISH_AUDIO_MODEL` | `s2.1-pro` o `s2.1-pro-free` |
| `FISH_AUDIO_VOICE_ID` | El reference ID de la voz de Fish Audio |

No pegues la clave en documentación, comandos, Git ni mensajes. Guarda esos valores
solo en el `.env` real del VPS. El servicio `backend` ya declara `env_file: .env` en
`docker-compose.yml`, así que Compose entrega automáticamente estas cuatro variables
al contenedor; no hace falta duplicarlas en `environment:`.

Después de guardar el archivo, desde `AranJuez360/deploy`, aplica el cambio para que
Compose recree el backend con el nuevo entorno:

```bash
sudo docker compose -f docker-compose.yml up -d
```

No hace falta reconstruir la imagen para cambiar variables de entorno. También se
puede seleccionar `JARVIS_TTS_PROVIDER=elevenlabs` con `ELEVENLABS_API_KEY`,
`ELEVENLABS_VOICE_ID` y `ELEVENLABS_MODEL`. Si el selector queda vacío, se conserva
el comportamiento previo: se elige ElevenLabs cuando hay clave y edge-tts cuando
no la hay. Si el proveedor remoto no está configurado o falla, Jarvis usa edge-tts.
