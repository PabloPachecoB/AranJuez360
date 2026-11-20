# Pruebas e2e — Paseo Aranjuez 360

Pruebas end-to-end con Playwright Test Agents. Montadas con el kit `ThinkUSoft-Toolkit\kit-pruebas-e2e`.

## Correr

| Qué | Cómo |
|---|---|
| Panel visual (recomendado) | Doble clic en `PRUEBAS.cmd` (raíz del repo) o `npm run ver` |
| Todas, en consola | `npm test` |
| Todas, viendo el navegador | `npm run visible` |
| Último reporte | `npm run reporte` |

No hace falta levantar nada antes: Playwright inicia su **propio backend (puerto 8002) y web (puerto 3002)**.

## Aislamiento

- Base de datos propia: `tmp/e2e/db.sqlite3` (se migra y se carga `cargar_demo` en cada arranque).
- Correos como archivos en `tmp/e2e/correos/`: así las pruebas leen el código de 6 dígitos del login.
- Tus datos de desarrollo (`backend/db.sqlite3`) no se tocan.

Usuarios de prueba (contraseña `Paseo2026!`): ver `utilidades/login.ts`.

## Agentes (Claude Code)

| Agente | Pedírselo así |
|---|---|
| Planner | "usa el planner para planificar pruebas de <flujo>; guarda el plan en e2e/specs/" |
| Generator | "usa el generator para generar las pruebas de e2e/specs/<plan>.md en e2e/tests/" |
| Healer | "usa el healer para arreglar las pruebas que fallan" |

Los agentes abren un navegador visible: se ve en vivo cómo navegan.
Parten de `tests/seed.spec.ts` (sesión iniciada como negocio).

## Estructura

```
e2e/
├── playwright.config.ts   servidores, puertos, base y correos de prueba
├── global-setup.ts        limpia los correos antes de cada corrida
├── utilidades/login.ts    login con código de verificación + usuarios demo
├── specs/                 planes en lenguaje natural (Planner)
└── tests/                 pruebas ejecutables (Generator)
```
