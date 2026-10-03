---
tags: [modulos, empresas, directorio, datos-reales]
actualizado: 2026-10-03
---

# Directorio y rubros

El directorio se organiza en dos niveles: **tipo de establecimiento → rubro**.
Ejemplo: **Negocio → Servicios → Tigo**. Así la app filtra rápido y [[Jarvis (asistente IA)|Jarvis]] busca primero el tipo y después el rubro.

## Tipos
- **Negocio** · **Emprendimiento** · **Oficina** (separadas; no se confunden con negocios de servicios) → [[Empresas]], [[Oficinas e invitaciones]]

## Rubros de negocios
`Comida` · `Electrónica` (incluye tecnología) · `Servicios` · `Ropa` (incluye moda y calzado) · `Cosméticos` (incluye belleza) · `Concesionaria` · `Banca` · `Otros` (joyería, hogar, juguetería… conservan la especialidad en la descripción).

| Rubro | Tiendas reales |
|---|---:|
| Comida | 23 |
| Ropa | 20 |
| Otros | 18 |
| Cosméticos | 6 |
| Electrónica | 2 |
| Servicios | 1 (Tigo) |
| Concesionaria / Banca | 0 (creadas, sin establecimientos) |

Alias de búsqueda (`tecnologia`, `moda`, `belleza`, `bancos`…) en `backend/empresas/rubros.py`.

## Las 70 tiendas reales
- Importadas de **paseoaranjuez.com/stores** → [[Fuentes de datos reales]].
- **70 logos, 12 portadas, 68 fotos de galería** (máx. 8 por tienda). 58 tiendas no publican galería.
- Todas como **Negocio**, sin horarios cargados (la app no las marca "Cerrado": muestra el estado solo si hay horarios).
- 69 cuentas demo `demo.<nombre>@paseo.bo` → [[Cuentas de demo]]. **HOY HAY** queda sin cuenta (pedido del usuario).

## En la app
- **Directorio**: lista, vista por piso y ofertas; filtros Todo / Comer / Tiendas / Emprendimientos + chips por rubro.
- **Ficha del negocio** (`EmpresaScreen`): portada, logo, rubro, piso, abierto/cerrado, WhatsApp/Instagram/Facebook, **galería** (se amplía al tocar), horarios, ofertas, productos, "Pedir aquí" → [[Comer y pedidos (PaseoYa)]] y "Preguntar a Jarvis".
- **Inicio → "Para comer"**: carrusel con las fotos reales de los restaurantes (primero los que tienen portada).

## Comandos
```bash
python manage.py importar_tiendas_paseo     # copia guardada (o --desde-web)
python manage.py organizar_rubros           # normaliza rubros sin tocar tipos ni cuentas
```

## Archivos clave
`backend/empresas/rubros.py` · `management/commands/importar_tiendas_paseo.py` · `organizar_rubros.py` · `datos/tiendas_paseo_aranjuez.json` · `app/screens/DirectorioScreen.js` · `app/screens/EmpresaScreen.js` · `docs/CARGA_TIENDAS_DEMO.md`
