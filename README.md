# AranJuez360

Plataforma del equipo para **Hackathon By Paseo 2026** (Paseo Aranjuez). Un solo backend/base de datos y dos interfaces (app cliente + web negocio/admin) compartidas por tres módulos integrados.

Documento base acordado por todo el equipo (nombres de tablas, rutas, estados, reglas): [`docs/BASE_PROYECTO_PASEO.md`](./docs/BASE_PROYECTO_PASEO.md). **Fuente de verdad — no renombrar campos/rutas sin acuerdo del equipo.**

## Módulos

| Módulo | Qué hace | Responsables |
|---|---|---|
| **PaseoYa** | Marketplace: compra desde el celular, retiro presencial obligatorio | Persona 1 (app), Persona 2 (web negocio) — Brenda, Alan |
| **Paseo Points** | Fidelización: puntos por compra, canje de recompensas | Persona 3 (backend/líder técnico), Persona 4 |
| **Jarvis Paseo** | Asistente IA que recomienda productos/promos/eventos | Persona 5 (IA), Persona 6 (chat + demo) |

## Estructura

```
/app      -> React Native (cliente)
/web      -> React + Vite (negocio y admin)
/backend  -> API y base de datos
/docs     -> documento base y presentación
```

## Flujo de trabajo

Cada persona trabaja en su propia rama y la une a `main` cuando su parte funciona. Nadie sube cambios directo a `main`.

## Recorrido de la demo

Cliente le pide algo a Jarvis → Jarvis recomienda un producto real → cliente compra en PaseoYa y recibe QR → negocio prepara y marca listo → cliente recoge, negocio escanea el QR → pedido entregado y puntos sumados → cliente canjea una recompensa.
