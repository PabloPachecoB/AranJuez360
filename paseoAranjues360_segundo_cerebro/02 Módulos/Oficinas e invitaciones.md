---
tags: [modulos, oficinas, diseño]
estado: diseño (no implementado)
---

# Oficinas e invitaciones

Las oficinas alquilan en el Paseo y brindan sus servicios aparte. No tienen caja de puntos; su módulo es **invitar visitantes**.

## Flujo propuesto
1. La oficina crea la invitación en la web: nombre del invitado, CI (opcional), **correo** y **celular** (separados), fecha, horario válido, motivo, tipo (**un solo uso** o **varios días**).
2. El sistema genera un **enlace con QR** (`paseo360.bo/i/<token>`) con oficina, piso y horario. Se comparte por WhatsApp, correo o imagen.
3. El invitado llega y muestra el QR — **no necesita la app**.
4. El portero lo escanea: ve nombre, oficina destino y piso, y si está ✅ válido / ⛔ vencido / ⛔ usado / ⛔ fuera de horario. Opcional: pedir CI.
5. La oficina ve quién llegó y a qué hora (opcional: aviso "tu invitado llegó").
6. Si el correo/celular del invitado coincide con una cuenta de la app → suma su **punto de visita**.

## Seguridad
QR no dinámico (el invitado no tiene app), pero limitado por fecha/horario, uso único, nombre visible para el portero y cancelable por la oficina.

## Para el dashboard
Invitados por día y por oficina · invitaciones generadas vs. usadas · horas de ingreso · invitados que se volvieron clientes.

## Preguntas abiertas
- ¿CI obligatorio u opcional?
- ¿Visitantes sin invitación: el portero los registra a mano o se niega el acceso?
- ¿Aviso a la oficina cuando llega su invitado?

Ver [[Pendientes]].
