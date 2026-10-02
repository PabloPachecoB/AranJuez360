# PaseoYa

Marketplace y plataforma de pedidos de Paseo Aranjuez — **Reto 3** de Hackathon By Paseo 2026.

## Problema

Los clientes de Paseo Aranjuez no saben qué establecimientos existen, qué productos venden, a qué precio ni si hay disponibilidad, y no quieren recorrer tiendas a ciegas buscando algo puntual.

## Solución

PaseoYa permite explorar el catálogo de todos los comercios del Paseo, comparar y pedir desde internet — pero con **retiro presencial obligatorio**: no hay delivery. El cliente paga online, recibe un código de retiro (QR/PIN), y debe acudir físicamente al Paseo para recogerlo, generando tráfico real hacia los locales.

## Usuarios

- **Cliente** — explora, compra, recibe código de retiro.
- **Comercio** — gestiona su catálogo y pedidos, valida el código al entregar.
- **Administrador** (si el tiempo lo permite) — supervisión general del Paseo.

## Arquitectura

- `frontend/` — cliente web (Brenda)
- `backend/` — API REST (Alan)

Frontend y backend se comunican por un contrato de API acordado por adelantado para poder trabajar en paralelo. Detalle completo de arquitectura, alcance de MVP y roadmap en la bóveda de Obsidian del equipo (fuera de este repo).

## Estado

🚧 En construcción durante el hackathon.

## Equipo

- Brenda — Frontend
- Alan — Backend
