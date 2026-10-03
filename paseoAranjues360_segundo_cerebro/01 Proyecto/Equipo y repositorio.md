---
tags: [proyecto, git]
---

# Equipo y repositorio

- **GitHub:** https://github.com/PabloPachecoB/AranJuez360
- **Rama principal:** `main`
- Otras ramas del equipo: `reto3-paseoya` (Alan021011, Persona 2 — PaseoYa), `master` (igual a `main` antiguo).

## Estructura del repositorio
```
app/       → React Native + Expo (clientes y porteros)
web/       → React + Vite (dashboard admin)
backend/   → Django + DRF
docs/      → documento base de la hackathon, módulo PaseoYa
paseoAranjues360_segundo_cerebro/ → este vault
```

## Forma de trabajo (README del equipo)
> Cada persona trabaja en su propia rama y la une a `main` cuando su parte funciona.

⚠️ El 2026-10-02 se unió directo a `main` por decisión del dueño del repo. **Avisar al equipo** del cambio de enfoque (PaseoYa → Paseo Aranjuez 360), sobre todo a quien trabaja en `reto3-paseoya`.

## Historial relevante
| Commit | Qué |
|---|---|
| `e5aa9ad` | Backend Django + app Expo (primer commit) |
| `22522c1` | Merge con el `main` del equipo |
| `c11a503` | Dashboard web admin y actividad de demo |

## Lo que NO se sube
`.env` (secretos), `db.sqlite3`, `.venv/`, `node_modules/`, `dist/`, `.vscode/`.
Quien clone: copiar `.env.example` → `.env` en `backend/` y `app/`, y correr `cargar_demo` → [[Levantar en VS Code]].
