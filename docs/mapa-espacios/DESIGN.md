# Design System: Mapa y espacios de Paseo Aranjuez

## 1. Tema visual y atmósfera

Vista administrativa clara, de densidad media. El plano arquitectónico es el elemento principal y su geometría original se respeta en ambos pisos. La pantalla toma como referencia las vistas “Mapa y espacios - Panel Administrativo Paseo Aranjuez” y “Mapa y espacios - Gestión de Pisos y Locales Físicos” del proyecto Paseo Aranjuez Visitor App en Google Stitch.

## 2. Paleta y funciones

- **Marfil de trabajo** (`#F7F9FF`): fondo del panel existente.
- **Superficie blanca** (`#FFFFFF`): visor y ficha de detalle.
- **Tinta carbón** (`#181C20`): texto principal.
- **Azul petróleo** (`#00324B`): navegación y selección activa.
- **Azul Aranjuez** (`#1C6586`): contorno al pasar el puntero y foco.
- **Dorado institucional** (`#DAA520`): indicador puntual de ficha vinculada.
- **Borde tenue** (`#C1C7CE`): separación estructural.

La selección y la vinculación son estados visuales diferentes. El azul señala el espacio elegido; un punto dorado señala una ficha encontrada en el directorio.

## 3. Tipografía

- **Títulos:** Manrope, peso 600–700, escala contenida.
- **Texto funcional:** Inter, 12–16 px, con interlineado suficiente para nombres de establecimientos en español.
- **Números sobre el plano:** Manrope, peso 800, sobre fondo contrastante.

Estas familias siguen el sistema de Stitch que ya usa el panel administrativo.

## 4. Componentes

- **Selector de piso:** dos controles de al menos 44 px, con estado activo en azul petróleo.
- **Plano:** SVG de 1600 × 1080 sin alterar sus trazados. Las zonas interactivas reutilizan los mismos contornos de cada local.
- **Etiqueta de local:** número centrado dentro del área, con fondo blanco; fondo azul cuando está seleccionado.
- **Ficha lateral:** número de espacio, planta y establecimientos asociados por piso y local. Presenta errores del directorio en la misma ficha.
- **Zoom:** controles de acercar, alejar y restaurar. El visor permite desplazamiento cuando el plano supera su ancho disponible.

## 5. Disposición adaptable

En escritorio el plano ocupa la columna principal y la ficha lateral una columna de 19 rem. En pantallas estrechas la ficha pasa debajo del visor. El desbordamiento horizontal queda contenido dentro del visor del plano para permitir explorar el dibujo sin mover toda la página.

## 6. Movimiento e interacción

Los contornos responden al puntero y al foco con un cambio breve de color. El estado seleccionado se mantiene visible hasta elegir otro espacio o cambiar de piso. Las preferencias de movimiento reducido desactivan la transición. Cada local admite teclado con Intro o Espacio.

## 7. Patrones excluidos

- No redibujar ni deformar los planos originales.
- No atribuir ocupantes, superficies o disponibilidad sin datos confirmados.
- No usar brillos de neón, gradientes decorativos ni sombras intensas.
- No cubrir el mapa con tarjetas o controles que oculten los números.
- No depender de una lista para seleccionar espacios físicos.
