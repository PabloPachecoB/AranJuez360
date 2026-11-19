---
tags: [tecnico, datos-reales, fuentes]
actualizado: 2026-10-03
---

# Fuentes de datos reales

Regla: **no inventar datos del Paseo**. Lo que no está confirmado se marca como referencial o pendiente.

## paseoaranjuez.com
| Qué | Ruta / origen | Se carga con |
|---|---|---|
| 70 tiendas (logo, piso, rubro, redes, fotos) | `/stores` (JSON) | `importar_tiendas_paseo` |
| Promociones | `/promotions` (vacío al 2026-10-03) | — |
| Cartelera y eventos | `/instagram/mercado_gastronomico_bypaseo/8` (publicaciones) | `importar_agenda_paseo` (JSON revisado a mano) |
| Imágenes | `/dashboard/storage/...` | se descargan a `backend/mediafiles/` |

Copias de revisión (solo locales, no se suben a GitHub): `docs/paseo_fuente_revision.html/.js`, `docs/paseo_publicaciones_revision.json`.

## Oficinas encontradas en internet (aún NO cargadas)
| Oficina | Actividad | Ubicación publicada | Confianza |
|---|---|---|---|
| **CONSESO** | Corredora de seguros | Torre II, piso 6, of. 610-611 | ✅ sitio oficial (conseso.com) — **elegida como primera ficha real** |
| Harris GBS | Software y servicios | Paseo Aranjuez, piso 8 | ✅ web oficial + Los Tiempos 2023 |
| RECUSOST | Sostenibilidad / eficiencia energética | Torre II, piso 9, of. 914 | directorio BDP |
| Minerva Montero | Dermatología y estética | Torre II, piso 6, of. 608 | directorio externo |
| Dr. Mauricio Luján | Traumatología | Torre II, piso 6, of. 608 | directorio externo (¿consultorio compartido?) |
| FLYHIGH Bolivia | Formación aeronáutica | Torre II, piso 7, of. 711 | directorio externo |
| Altos del Oeste S.R.L. | Inmobiliaria | piso 14 | directorio externo |

- **Patiño**: el usuario dice que hay una oficina relacionada en el edificio; **no se encontró confirmación pública** (la Fundación Simón I. Patiño publica Av. Potosí 1450). Pendiente de confirmar en persona.
- Las 3 oficinas actuales (Estudio Legal Andino, Consultorio Dental Sonrisa, Agencia Digital Tunari) son **de demo**.

## Precios
- Menús: **referenciales** → [[Comer y pedidos (PaseoYa)]]
- Cine y eventos: la fuente no publica precios → [[Diversión (cartelera y eventos)]]

## Servir imágenes
Los logos son `.webp`. En Windows se registró `mimetypes.add_type("image/webp", ".webp")` en `settings.py` para que no salgan como `octet-stream` → [[Problemas comunes]]
