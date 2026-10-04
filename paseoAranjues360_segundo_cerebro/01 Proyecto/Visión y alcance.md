---
tags: [proyecto]
---

# Visión y alcance

**Paseo Aranjuez 360** = una sola plataforma para controlar los módulos del Paseo desde una **web administrativa** y una **app** para clientes y porteros.

## Qué SÍ hacemos
- **Fidelización (Paseo Points)** como reto principal → [[Fidelización]]
  - Puntos por **visitar** el Paseo (el portero escanea el QR del cliente).
  - Puntos por **comprar** (el cliente escanea el QR/NFC de la caja; el cajero aprueba).
- **Directorio de empresas** con ficha, horarios, productos y ofertas → [[Empresas]]
- **Oficinas** con invitaciones QR para sus visitantes → [[Oficinas e invitaciones]]
- **Dashboard** para que la administración tome decisiones → [[Dashboard admin]]
- **Asistente IA (Jarvis)** con datos reales → [[Jarvis (asistente IA)]]
- **Comer (PaseoYa)**: pedido desde la app y retiro en el local → [[Comer y pedidos (PaseoYa)]]
- **Diversión**: cartelera y eventos reales → [[Diversión (cartelera y eventos)]]

## Qué NO hacemos
- ❌ **El admin del Paseo no ve los pedidos ni ventas de las empresas.** Cada negocio ve solo los suyos; la visibilidad comercial del Paseo es por los **tickets de fidelización**.
- ❌ No hay delivery: los pedidos de Comer se **retiran en el local** con código.
- ❌ Locales, contratos, finanzas y mantenimiento del mall quedaron fuera por ahora.

## Origen
- El documento `BASE_PROYECTO_PASEO.md` (de la hackathon, con PaseoYa / Points / Jarvis) y el esqueleto de backend portado de TorreSegura **no definen el rumbo**: solo sirvieron para construir más rápido.
- Ver [[Reglas de la hackathon]] y [[Decisiones]].

## Límite importante (decirlo en la presentación)
Solo se mide lo que pasa por el sistema:
- **Visitas** = clientes con app registrados en portería (no todo el tráfico del Paseo).
- **Ventas** = compras registradas para puntos (no las ventas totales de cada tienda).
