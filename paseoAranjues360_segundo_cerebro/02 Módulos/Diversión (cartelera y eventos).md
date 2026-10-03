---
tags: [modulos, entretenimiento, datos-reales]
actualizado: 2026-10-03
---

# Diversión: cartelera y eventos

Antes había 4 películas y 4 eventos **ficticios**. Desde 2026-10-03 se usan los **reales** que publica el Mercado Gastronómico en paseoaranjuez.com (feed de Instagram `@mercado_gastronomico_bypaseo`).

## Cinema Lounge (Mercado Gastronómico, piso 3)
| Película | Función |
|---|---|
| Exterminio (28 Días Después) | Vie 2 oct, 18:30 |
| Demon Slayer: Castillo Infinito | Sáb 3 oct, 15:30 |
| Weapons (La Hora de la Desaparición) | Sáb 3 oct, 19:00 |
| Hotel Transilvania | Dom 4 oct, 14:30 |
| Monsters, Inc. | Dom 4 oct, 18:00 |

Reservas de cumpleaños del Cinema Lounge: 61795513.

## Eventos — El Club by Mercado Gastronómico (piso 3)
- Vie 2: **Feria La Tribu** (11:00–22:00) y **Emily Guzman en concierto** (19:30)
- Sáb 3: **Gran Torneo de Rubik** (17:00)
- Dom 4: **Un Domingo de Bingo Familiar** (15:00–18:00)

Los eventos traen la imagen del afiche; en la app se ve en miniatura y al tocar se abre el detalle (con opción de preguntar a Jarvis).

## Reglas
- Películas sin funciones futuras se ocultan (no salen como "Próximamente").
- `cargar_demo` ya **no** crea los datos ficticios; llama a `importar_agenda_paseo`, que además los retira.
- ⚠️ La fuente **no publica precios** ni clasificación. Clasificación y duración son las de la película original. Sin precio → la app pide "pagar en boletería" y los eventos aparecen como "Entrada libre" (puede no ser cierto).

## Actualizar cada semana (manual)
La agenda se publica como texto de Instagram, así que se revisa a mano:
1. Ver publicaciones en paseoaranjuez.com.
2. Editar `backend/entretenimiento/datos/agenda_paseo.json` (cada entrada guarda su enlace `fuente`).
3. `python manage.py importar_agenda_paseo`

## Archivos clave
`backend/entretenimiento/management/commands/importar_agenda_paseo.py` · `datos/agenda_paseo.json` · `app/screens/DiversionScreen.js`

Relacionado: [[Fuentes de datos reales]] · [[Pendientes]]
