---
tags: [guia, pruebas, e2e]
actualizado: 2026-10-19
---

# Pruebas e2e (Playwright)

Pruebas automáticas que abren la web en un navegador y la usan como un usuario real. Hoy cubren el **panel de negocio** (Café Aranjuez): **28 pruebas, todas en verde** (2026-10-19, commit `8ebee63` en `integracion-equipo`).

## Cómo correrlas
- **Panel visual:** doble clic en `PRUEBAS.cmd` (raíz del repo). **No cerrar la ventana negra**: mantiene vivos el panel, el backend y la web. Elegir una prueba y ▶.
- **Terminal:** `cd e2e` → `npx playwright test` (con `$env:E2E_VISIBLE=1` se ve el navegador).
- **Reporte con capturas:** `e2e\playwright-report\index.html`.
- Tarda ~4–5 min las 28. No hace falta crear usuarios: todo sale de `cargar_demo` → [[Cuentas de demo]].

## Cómo funcionan
- Levantan **su propio backend (puerto 8002) y web (3002)** con una base aparte `tmp\e2e\db.sqlite3`: no tocan los datos de desarrollo.
- El **código de 6 dígitos** del login se lee de archivo: en modo prueba los correos se guardan en `tmp\e2e\correos`.
- Las pruebas que crean algo usan **nombres únicos** (`Date.now()`) y **borran lo que crean** (ofertas, recompensas). Editar / pausar / eliminar trabajan sobre un producto propio, nunca sobre los de demo.

## Qué cubren
| Archivo (`e2e\tests\`) | Casos |
|---|---|
| `acceso.spec.ts` | login con código, contraseña y código incorrectos, cerrar sesión |
| `productos.spec.ts` | listado, crear, validación sin nombre, cancelar, buscar, filtro, pausar, editar, eliminar |
| `secciones.spec.ts` | pedidos (vacío, código de retiro falso), caja (pestañas, cupón falso), recompensas (catálogo, publicar), ofertas (listado, agregar) |
| `negocio.spec.ts` | resumen de ventas, editar info comercial, horarios |
| `ficha.spec.ts` | guardar ficha, URL inválida, "Ver mi página" |

Plan completo: `e2e\specs\panel-negocio.md` (lo escribió el agente planner explorando la app).

## Agentes (Playwright Test Agents)
- **planner** explora la app y escribe el plan · **generator** convierte el plan en pruebas · **healer** corre y arregla las que fallan.
- Están en `.claude/agents/`; el servidor MCP `playwright-test` en `.mcp.json` (con `E2E_VISIBLE=1` el navegador del agente se ve en vivo).
- El kit reutilizable para otros proyectos está en `ThinkUSoft-Toolkit` (skill `e2e-setup`, se pide con "monta e2e").

## Lo que rescatamos (sirve fuera de este proyecto)
Las pruebas en sí son de Paseo 360 (pantallas, botones, usuarios de demo). Lo que se lleva a cualquier proyecto:
1. **El método:** explorar → plan escrito → pruebas → arreglar. El plan en Markdown lo puede leer y revisar alguien que no programa.
2. **Base de prueba aparte** levantada por la propia configuración: nunca se ensucian datos reales.
3. **Login con código sin correo real:** guardar los correos como archivos y leer el código de ahí.
4. **No depender de datos compartidos:** cada prueba crea lo suyo con nombre único y lo limpia.
5. **Buscar por lo que ve el usuario** (botón "Guardar", fila "Capuchino"), no por clases CSS: aguanta cambios de diseño.
6. **Un lanzador de doble clic** (`PRUEBAS.cmd`) para que cualquiera del equipo las corra.

## Hallazgos en la app
- Los íconos `material-symbols` son texto dentro del mismo elemento ("location_on Frente a…"): buscar ese texto **exacto** falla. Ojo también para lectores de pantalla.
- En **Mi negocio** (`NegocioPage.tsx`) y el modal de producto, los `<label>` **no están asociados** a su campo (sin `htmlFor`): las pruebas tienen que usar `name`, placeholder o posición. Es un problema de accesibilidad → conviene corregir.
- `/negocio` muestra el horario con segundos ("10:00:00–21:00:00").

## Falta
- **Flujo completo de compra:** cliente pide → negocio prepara → entrega con código → cliente gana monedas. Es la prueba de más valor y no existe.
- Pruebas del **panel admin**, la **app del cliente**, **Jarvis** y la **Billetera** → [[Billetera Paseo (saldo de regalo)]] · [[Jarvis (asistente IA)]]
- La base de prueba no se reinicia entre corridas (crece con productos "Pausar 17…", "Editar 17…").
