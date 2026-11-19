# Jarvis con cuerpo

El personaje reutilizable vive en `app/components/JarvisCuerpo.js`. Está integrado
en `JarvisMini` (inicio, 80 px de ancho) y `AvatarJarvis` (modo voz, 210 px).
Mantiene la identidad azul/dorada y la antena del Paseo, con ojos grandes,
pupilas, cejas, mejillas, pañuelo y un cuerpo de proporciones redondeadas.
No necesita imágenes ni dependencias nuevas.

## Entradas

- `ancho`: escala proporcional; altura = ancho × 1,3.
- `estado`: `inactivo`, `escuchando`, `pensando`, `hablando`.
- `emocion`: `amable`, `feliz`, `enojado`, `serio`, `curioso`, `sorprendido`, `triste`.
  También acepta las etiquetas existentes del modo voz (`warmly`, `excited`, etc.).
  Cambia ojos, párpados, cejas, boca y postura. La emoción no se infiere de la cámara.
  El modo voz solo aplica la emoción de la respuesta mientras Jarvis habla.
- `nivel`: volumen de micrófono entre 0 y 1; ilumina visualmente la insignia al escuchar.
- `saludar`: activa un saludo ocasional en reposo.
- `mirada`: -1 a 1; `null` permite mirar alrededor durante el reposo.
- `halo`: muestra un fondo suave que acompaña el color de la expresión.
- `animado`: permite detener el movimiento sin perder la expresión ni la pose.

También hay poses `analizando`, `indicando`, `autorizado` y `denegado` para la
futura recepción. Son estados visuales: no leen QR ni deciden permisos. El futuro
controlador debe activarlos según la detección y las respuestas reales del backend.
`indicando` señala hacia la derecha de la pantalla; no representa todavía una ruta
real del edificio.

Las animaciones se detienen al desmontar el componente y en segundo plano.
Con reducción de movimiento se conservan poses estáticas. La boca se anima durante
el estado `hablando`; no hay sincronización de fonemas ni seguimiento de cámara.

## Comprobación

Vista interactiva, desde la raíz del repositorio (con dependencias de app y web instaladas):

```sh
node app/preview/jarvis/build.mjs --serve
```

Abre `http://127.0.0.1:4317`. Permite comparar siete expresiones, cinco estados,
fondos claro/oscuro y pausar el movimiento. Es una demostración visual sin cámara,
QR ni audio conectados. No cambia la configuración de Vite de la web principal.

Comprobado con Chrome: cambio de las siete expresiones, estados de análisis,
escucha, habla e indicación; movimiento activo; reducción de movimiento estable;
ancho móvil de 390 px sin desbordamiento; sin excepciones JavaScript.

La exportación web de Expo permite comprobar la integración sin backend:
`npx.cmd expo export --platform web --output-dir node_modules/.cache/jarvis-export`.
La revisión en teléfono físico, el encuadre de cámara y la recepción web dedicada
quedan pendientes. No se modificaron las pantallas que estaban en edición paralela.

## Referencias visuales

- [Duolingo: lenguaje de formas](https://blog.duolingo.com/shape-language-duolingos-art-style/):
  simplicidad, exageración y carácter. Aplicado a una mascota original azul, no al búho Duo.
- [Duolingo: construcción de personajes](https://blog.duolingo.com/building-character/):
  silueta reconocible, ojos expresivos y coherencia visual.
- [Rive: estados y transiciones](https://rive.app/docs/editor/state-machine/state-machine):
  referencia conceptual para coordinar reacciones. La implementación sigue usando
  React Native Animated; no se añadió Rive ni se requiere un archivo .riv.
