---
tags: [modulos, entretenimiento, datos-reales]
actualizado: 2026-10-03
---

# Diversión: cartelera y eventos

Desde 2026-10-03 se usan la cartelera y los eventos **reales** que publican el Mercado Gastronómico y El Cuarto en paseoaranjuez.com (feeds de Instagram `@mercado_gastronomico_bypaseo` y `@elcuartobypaseo`). Los 4 ficticios de la demo quedaron inactivos.

## Cinema Lounge (Mercado Gastronómico, piso 3)
Horarios verificados contra la publicación oficial ([Dd5VZwjFWjJ](https://www.instagram.com/p/Dd5VZwjFWjJ)) ✅

| Película | Función | Precio* | Póster |
|---|---|---:|---|
| Exterminio (28 Días Después) | Vie 2 oct, 18:30 | Bs 40 | ✅ |
| Demon Slayer: Castillo Infinito | Sáb 3 oct, 15:30 | Bs 40 | ✅ |
| Weapons (La Hora de la Desaparición) | Sáb 3 oct, 19:00 | Bs 40 | ✅ |
| Hotel Transilvania | Dom 4 oct, 14:30 | Bs 35 | ✅ |
| Monsters, Inc. | Dom 4 oct, 18:00 | Bs 35 | ✅ |

Reservas de cumpleaños del Cinema Lounge: 61795513.

## Eventos
Horarios verificados contra [Dd4N9s0lRpi](https://www.instagram.com/p/Dd4N9s0lRpi) (El Club) y [Dd4vc28gqbv](https://www.instagram.com/p/Dd4vc28gqbv) (El Cuarto) ✅

| Evento | Cuándo | Dónde | Entrada* |
|---|---|---|---:|
| Feria La Tribu | Vie 2, 11:00–22:00 | El Club, piso 3 | Libre |
| Emily Guzman en concierto | Vie 2, 19:30 | El Club, piso 3 | Bs 30 |
| Gran Torneo de Rubik | Sáb 3, 17:00 | El Club, piso 3 | Bs 20 |
| En Coma: clásicos de la cumbia | Sáb 3, 21:00** | El Cuarto, piso 4 | Bs 40 |
| Brunch Sinfónico: José José por Luis Vaca ⭐ | Dom 4, 11:00–14:00** | El Cuarto, piso 4 | Bs 120 |
| Un Domingo de Bingo Familiar ⭐ | Dom 4, 15:00–18:00 | El Club, piso 3 | Bs 15 |

\* **Precios referenciales**: la fuente no publica precios; se cargaron desde el admin el 2026-10-03. Confirmar con cada local.
\** La publicación de El Cuarto da el día pero no la hora: hora estimada.
⭐ destacado (sale en el Inicio de la app).

## Cómo se cargó (con las herramientas del admin)
- Pósters: los oficiales de Wikipedia, subidos con `PATCH admin/peliculas/{id}/` (campo `poster`). Exterminio venía apaisado: se recortó al centro en 2:3.
- Precios de funciones: `PATCH admin/funciones/{id}/` · precios de eventos: `PATCH admin/eventos/{id}/` (precio 0 = entrada libre).
- Eventos de El Cuarto: `POST admin/eventos/` con el afiche de la publicación.
- Todo quedó también en `agenda_paseo.json` (`precio`, `poster`) para que el importador lo reproduzca.

## En la app
- Cartelera con pósters; detalle con sinopsis, funciones por día y precio.
- **Detalle del evento con diseño** (antes era una alerta del sistema que en web salía como nota sin estilo): banner con el afiche, chips de categoría y destacado, tarjeta con fecha, horario, lugar y entrada, descripción y "Preguntarle a Jarvis".
- El evento destacado del Inicio ("Ver evento") abre directamente su detalle.
- Los afiches del Mercado Vivo son uno solo para todo el fin de semana: el banner muestra solo la parte superior ("El Club · Mercado Vivo") para no confundir con el texto de otro evento.

## Reglas
- Películas sin funciones futuras se ocultan (no salen como "Próximamente").
- `cargar_demo` ya **no** crea los datos ficticios; llama a `importar_agenda_paseo`, que además los retira.
- El importador **respeta** precios y pósters: aplica el `precio` del JSON, solo descarga el póster si la película no tiene uno y ya no borra las funciones que siguen vigentes.

## Actualizar cada semana (manual)
La agenda se publica como texto de Instagram, así que se revisa a mano:
1. Ver publicaciones en paseoaranjuez.com (Mercado Gastronómico **y El Cuarto**).
2. Editar `backend/entretenimiento/datos/agenda_paseo.json` (cada entrada guarda su enlace `fuente`), o cargarlo desde el admin.
3. `python manage.py importar_agenda_paseo`

## Archivos clave
`backend/entretenimiento/management/commands/importar_agenda_paseo.py` · `datos/agenda_paseo.json` · `app/screens/DiversionScreen.js` (`DetalleEvento`, `DetallePelicula`) · `app/screens/HomeScreen.js`

Relacionado: [[Fuentes de datos reales]] · [[Pendientes]]
