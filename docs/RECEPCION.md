# Recepción virtual con Jarvis

## Probarla

1. Inicia el backend Django como indica el README raíz. Crea o usa un usuario
   activo de rol `PORTERO`; la web usa el acceso existente con código por correo.
2. Inicia `web` con `npm run dev`. Entra en `/recepcion` y autentícate con esa
   cuenta. Al ser PORTERO, la web abre la recepción a pantalla completa.
3. Toca **Activar recepción**, permite la cámara y prueba el saludo con una persona
   frente al lente. Usa **Configurar cámara** para seleccionar la Logitech si el
   ordenador tiene más de una cámara. Activa la pantalla completa con el botón.
4. Acerca un QR real emitido por una oficina o prueba un código de ocho caracteres
   en el lector de código manual.

Cámara y micrófono requieren HTTPS en un dispositivo de la red; `localhost` sirve
para desarrollo en el propio ordenador. En el desarrollo con Vite, configura
`VITE_BACKEND_URL` con la dirección del backend accesible desde ese ordenador;
por defecto el proxy apunta a `127.0.0.1:8001`. El navegador solicita el micrófono solo
al tocar **Hablar con Jarvis**. El sintetizador usa la voz en español disponible
en el navegador. Para transcribir audio también debe configurarse
`QWEN_AUDIO_MODEL` en el backend. El chat normal requiere un proveedor LLM
configurado; sin él, directorio, ofertas y QR siguen disponibles.

## Baños, ascensor y otros lugares

El asistente solo indica sitios que estén configurados para el edificio de esta
pantalla. Agrega a `backend/.env` el ajuste `RECEPCION_PUNTOS_INTERES_JSON`, por
ejemplo (reemplaza piso e indicaciones por la ubicación real):

```dotenv
RECEPCION_PUNTOS_INTERES_JSON=[{"nombre":"Baños","piso":"2","indicaciones":"Frente al ascensor del piso 2"},{"nombre":"Ascensor","piso":"Planta baja","indicaciones":"A tu izquierda, detrás del mostrador"}]
```

Reinicia Django y vuelve a abrir la recepción. Así Jarvis nunca inventa que el
ascensor queda detrás de la pantalla cuando la orientación instalada es otra.
Los horarios provienen de la ficha real de cada empresa; las ofertas son las
vigentes hoy.

## Privacidad y acceso

- La cuenta PORTERO autoriza la pantalla y sus cuatro rutas bajo `/api/v1/agente/recepcion/`.
- Detección de presencia y lectura del QR ocurren en el navegador. El clasificador
  de rostros de MediaPipe identifica posiciones, nunca nombres o emociones. No se
  almacenan video, caras, fotos ni eventos de paso.
- Solo se envía al backend el código extraído del QR. Validar una invitación no la
  consume ni registra el ingreso: la portería conserva su flujo de confirmación.
- Al visitante no se le expone la cuenta PORTERO ni su saldo. El historial existe
  solo en memoria del navegador y se borra al empezar una consulta, tras doce
  segundos fuera de la zona de atención o tras noventa segundos sin interacción.
- El botón de conversación **escrito** no envía imágenes. Al tocar el micrófono,
  la voz se envía al servidor para su transcripción; luego solo viaja el texto.
- El backend requiere PORTERO, limita las llamadas y no devuelve CI, celular,
  nombre ni motivo de visita durante la verificación del QR.

El efecto "acerca tu QR" se enciende al pedir una validación en el panel o al
detectar un QR. La animación comunica que se consulta al servidor; solo la
respuesta factual firmada por la API decide si el permiso está vigente.

Modelo de presencia y referencias: [guía oficial MediaPipe Face Detector para
web](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector/web_js)
y [lector QR jsQR](https://github.com/cozmo/jsQR). Sus binarios se guardan en
`web/public/modelos` y se sirven desde la aplicación; no hay CDN requerido por
la cámara durante su ejecución.
