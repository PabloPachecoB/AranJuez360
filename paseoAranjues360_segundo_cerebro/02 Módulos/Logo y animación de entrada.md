---
tags: [modulos, marca, app, diseño]
actualizado: 2026-10-03
---

# Logo y animación de entrada

## Logo "360 Paseo Aranjuez" (vectorial)
- `app/assets/paseo_aranjuez_logo.svg`: SVG puro, recreado midiendo el logo original (PNG del equipo).
  - **3**: barra superior con corte diagonal + U inferior.
  - **6**: diagonal arriba + U inferior.
  - **0** = sello tipo moneda: anillos, laureles, estrellas arriba y abajo, diana central con 4 agujas.
  - Franja horizontal (y 140–292) que corta las tres piezas con "Paseo Aranjuez".
- `app/assets/logo-moneda.svg`: solo el sello, con un **brillo** animado que cruza la tinta negra cada 4 s.
- `app/assets/logo-paseo360.png`: el original del equipo (baja resolución, ya no se usa).
- El sello es una versión **simplificada**; el original tiene laureles más tupidos y otro símbolo central. Si aparece el sello en alta resolución, calcarlo.

## Componentes de la app
| Componente | Dónde | Qué hace |
|---|---|---|
| `IntroLogo` | Login | Las torres del Paseo se dibujan como un plano y se transforman en el logo 360 (≈5 s). Tocar = saltar. |
| `SelloAnimado` | Registro, desbloqueo con huella | Sello con brillo; exporta `Sello` para reutilizar el dibujo. |

## Animación del login (por etapas)
1. **0–1,5 s** contornos de las dos torres en perspectiva (vista desde abajo, como `Torres gemelas modernas en línea arquitectónica.png`), podio y piso.
2. **0,9–2,3 s** ventanales (siguen la inclinación de cada cara), coronas, columnas.
3. **2,6–4,1 s** la torre baja se curva hasta ser el anillo del sello (morph real, cuadrilátero → círculo) · la torre alta se "des-traza" mientras se dibujan el 3 y el 6, que luego se rellenan · el podio se convierte en la franja.
4. **3,6–5 s** sello completo y "Paseo Aranjuez" (el espaciado se cierra).
5. El formulario aparece con un fundido.

- Hecho con `react-native-svg` + `Animated` (sin librerías nuevas). Los tiempos están en `T` dentro de `IntroLogo.js`.
- Respeta "reducir movimiento" (muestra el logo final).
- Probado en Chrome (Expo web); **falta probar en el teléfono**.

Relacionado: [[Registro y acceso]] · [[Pendientes]]
