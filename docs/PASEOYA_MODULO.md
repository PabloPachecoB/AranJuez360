# Módulo PaseoYa (Persona 1 y 2)

Marketplace y plataforma de pedidos de Paseo Aranjuez.

## Problema

Los clientes de Paseo Aranjuez no saben qué establecimientos existen, qué productos venden, a qué precio ni si hay disponibilidad, y no quieren recorrer tiendas a ciegas buscando algo puntual.

## Solución

PaseoYa permite explorar el catálogo de todos los comercios del Paseo, comparar y pedir desde internet — pero con **retiro presencial obligatorio**: no hay delivery. El cliente paga online, recibe un código de retiro (QR/PIN), y debe acudir físicamente al Paseo para recogerlo, generando tráfico real hacia los locales.

## Usuarios y responsables

- **Persona 1 (Brenda) — app del cliente** (`/app`): categorías, catálogo, buscador, carrito, mis pedidos, QR de retiro.
- **Persona 2 (Alan) — panel web del negocio** (`/web`): productos, promociones, pedidos entrantes, validar QR al entregar.

> Pendiente: confirmar si Alan=Persona 2 y Brenda=Persona 1, o se divide distinto — ver nota en Equipo.md de la bóveda de Obsidian.

Esquema de datos y rutas exactas: [`BASE_PROYECTO_PASEO.md`](./BASE_PROYECTO_PASEO.md), secciones 4 y 6.

## Estado

🚧 En construcción durante el hackathon.
