# Contexto para continuar — Módulo PaseoYa (Persona 2)

> Pega este archivo completo al inicio de la conversación con tu IA para que tenga contexto completo y pueda seguir donde quedó. Generado el 2026-10-02.

## Quién eres en este proyecto

Eres (o ayudas a) **Alan, Persona 2** del equipo de 6 personas de **Hackathon By Paseo 2026** (Paseo Aranjuez). Tu responsabilidad: **panel web del negocio** (React + Vite) dentro del módulo **PaseoYa**. Brenda (Persona 1) hace la app cliente en React Native — no es tu tarea, pero comparten el mismo backend.

## El evento

Hackathon de fin de semana en Paseo Aranjuez (3 retos, equipos presentan ante jurado). Premios del hackathon: oportunidad laboral en On Business (Colombia), pasantía en Robologic, 10 medias becas en Digital Services. **Fechas exactas: aún no confirmadas.**

## El producto real: NO son 3 proyectos separados

El equipo construye **un solo producto integrado** con tres módulos, un solo backend/BD, y dos interfaces compartidas:
- **PaseoYa** (reto principal, el tuyo): marketplace con **retiro presencial obligatorio** — no hay delivery, es la condición central no negociable. Persona 1 (app) + Persona 2 (web negocio, tú).
- **Paseo Points**: fidelización, puntos al entregar un pedido. Persona 3 (backend/líder técnico, dueño de BD/login/API compartida) + Persona 4 (pantallas de puntos + panel admin).
- **Jarvis Paseo**: asistente IA que recomienda productos reales de la base. Persona 5 (bot) + Persona 6 (chat UI + demo).

## Documento base del equipo — FUENTE DE VERDAD

Un compañero compartió un `.md` acordado por las 6 personas. Está copiado íntegro en [`docs/BASE_PROYECTO_PASEO.md`](./BASE_PROYECTO_PASEO.md) de este mismo repo. **Léelo antes de escribir código.** Reglas clave que no se negocian sin avisar al equipo:
- Nombres de tablas/campos en `snake_case` exactos (`producto_id`, `codigo_retiro`, `listo_para_recoger`, etc.) — no inventar en inglés/camelCase.
- Estados de pedido: `recibido → confirmado → preparando → listo_para_recoger → entregado` (+ `cancelado` opcional antes de listo_para_recoger).
- Los puntos se suman solo al pasar a `entregado`, disparado por el negocio escaneando el QR del pedido — una sola vez.
- Un pedido pertenece a un solo negocio (carrito multi-negocio = varios pedidos).
- Stack ya decidido por el equipo: app=React Native, web=React+Vite. **Backend/BD/modelo de IA: "POR DEFINIR" por el equipo (Persona 3), no es tu decisión.**
- Estructura del repo: `/app` `/web` `/backend` `/docs`. Flujo git: rama por persona, merge a `main` cuando funciona, **nadie pushea directo a main**.

## Reto oficial 3 (PaseoYa) — resumen

Resuelve que los clientes no conocen los comercios/productos/precios/disponibilidad del Paseo. El cliente explora, compra y paga online, pero **debe recoger en persona** (genera tráfico físico, es el objetivo estratégico). Roles: Cliente, Comercio (panel propio — lo que tú construyes), Administrador. Código de retiro (QR/PIN) generado por pedido, validado por el comercio al entregar.

Ya se comparó el reto oficial contra el doc del equipo — sin contradicciones mayores. Dos gaps ya resueltos:
1. **"Consultar ventas" (Comercio)** no tiene ruta de API en el doc del equipo → decisión tomada: calcularlo **client-side** a partir de `GET /pedidos` (que ya se trae para el panel de pedidos), sin pedir ruta nueva.
2. Capacidades de Admin (administrar negocios/usuarios/categorías) sin ruta definida — no es tu módulo, solo queda anotado para el equipo (Persona 3/4), no te bloquea.

## Repositorio

- GitHub: **`PabloPachecoB/AranJuez360`** (monorepo de todo el equipo, no uno por reto). Push access confirmado (cuenta `Alan021011`).
- Local: `C:\Users\alanm\OneDrive\Documents\apps\PaseoYa`
- Rama de trabajo actual: **`reto3-paseoya`** (ya pusheada a origin). `main`/`master` son la rama compartida — no tocar directo.
- Estructura:
  ```
  /app/README.md            genérico (React Native)
  /app/paseoya/              scope Persona 1 (Brenda) — no tocar
  /web/README.md            genérico (React + Vite)
  /web/paseoya/              ← TU CÓDIGO VA AQUÍ (Persona 2)
  /backend/README.md        genérico (compartido, stack TBD)
  /backend/paseoya/          scope de rutas PaseoYa (pendiente del stack del equipo)
  /docs/BASE_PROYECTO_PASEO.md   doc base del equipo (fuente de verdad)
  /docs/PASEOYA_MODULO.md        resumen del módulo PaseoYa
  /docs/CONTEXTO_PARA_IA.md      este archivo
  README.md (raíz)          overview de AranJuez360
  ```
- Regla explícita del usuario: **no mezclar ni modificar nada fuera de `app/paseoya`, `web/paseoya`, `backend/paseoya`** — todo lo demás (READMEs genéricos, docs del equipo) se deja intacto.
- Los commits de este repo **no llevan atribución de coautoría de IA** (se reescribió el historial a pedido explícito del usuario) — no agregar ese trailer en commits futuros aquí.

## Estado actual (2026-10-02, fin de esta sesión)

- **Cero código escrito todavía.** Solo estructura de carpetas y READMEs placeholder.
- Se intentó generar un mockup visual del panel de productos con **Stitch** (MCP de diseño UI de Google) — proyecto creado (`PaseoYa - Panel Negocio`, id `379835711003322326`) y design system (tema naranja/cálido, Plus Jakarta Sans + Inter, id `assets/9647468895500728857`), pero **4 intentos de generación fallaron por timeout**, sin ninguna pantalla creada. El usuario corrió `claude mcp add stitch ...` en su terminal intentando arreglar la conexión, sin éxito todavía. No es bloqueante — se decidió seguir sin mockup.
- **Siguiente paso acordado:** scaffoldear React + Vite en `web/paseoya/` y construir el panel de productos (CRUD productos del negocio) directamente en código, con **datos mock** (negocio y productos inventados, reemplazables después), ya que el backend real sigue "por definir" por el equipo.

## Prioridad de construcción (doc del equipo, sección 10, aplicado a tu parte)

"Empezar por el panel de productos, para que la app [de Brenda] tenga datos que mostrar." Después: pedidos entrantes con cambio de estado, validar código de retiro, y el resumen de ventas calculado client-side.

## Pendientes reales (no asumir resueltos)

- Fechas exactas del hackathon.
- Negocio/productos de prueba concretos — de momento se van a inventar datos de ejemplo razonables.
- Stack de backend/BD — decisión de Persona 3, no bloquea seguir con el frontend mockeado.
- Confirmar con Brenda las herramientas específicas de su lado (Expo u otro) — no afecta tu trabajo en `/web`.

## Dónde más vive el contexto

Bóveda de Obsidian (planificación, fuera del repo): `C:\Users\alanm\OneDrive\Documents\Hackathon\`. Notas clave: "Base del Proyecto (equipo).md" (mismo contenido que `docs/BASE_PROYECTO_PASEO.md`), "Equipo.md" (personas confirmadas), "Roadmap del Fin de Semana.md", "MVP y Alcance.md".
