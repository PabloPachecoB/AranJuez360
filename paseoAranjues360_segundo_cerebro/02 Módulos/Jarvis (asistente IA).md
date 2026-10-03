---
tags: [modulos, ia, jarvis]
actualizado: 2026-10-03
---

# Jarvis (asistente IA)

Asistente del Paseo en la app (chat y modo voz). Responde **solo con datos reales del backend**; el contexto se arma en `backend/agente/contexto.py` en cada turno.

## Qué sabe
- Directorio agrupado **por tipo y rubro** (hasta 80 establecimientos, incluye oficinas) → [[Directorio y rubros]]
- **Menú de cada local** (hasta 5 platos con precio) → [[Comer y pedidos (PaseoYa)]]
- Ofertas vigentes, cartelera y eventos → [[Diversión (cartelera y eventos)]]
- Saldo, recompensas, reservas y cupones del usuario → [[Monedero y recompensas]]

## Comportamientos
- **Estado de ánimo / antojos**: si el usuario dice "estoy triste, ¿qué puedo comer?", acompaña con empatía y recomienda 1–2 platos concretos con precio, local y piso.
  > Respuesta real (2026-10-03): *"Lamento que te sientas así, a veces un gusto ayuda. Prueba el Waffle de Nutella y frutilla en Waffle King, piso 3, por Bs 32, o unos Churros con chocolate en Churros Calientes, piso 4, por Bs 22."*
- **Fichas con logo**: la respuesta del chat trae `empresas` (los locales que Jarvis nombró, máx. 4). La app las muestra bajo el globo y al tocarlas abre la ficha. Coincidencia por palabra completa ("contigo" no trae a Tigo).
- **Acciones con confirmación**: reservar cine, canjear recompensas, cancelar reservas (botón Confirmar).
- No inventa locales en rubros vacíos ni convierte monedas a Bs.

## Dónde se usa Jarvis en la app
Buscador del Inicio, botón central (modo voz), tarjeta "Hablar con Jarvis", botón "Preguntar a Jarvis" en fichas y eventos. Los atajos (Comer, Tiendas, Promos, Mapa, Servicios) **ya no** abren el chat: van a su pantalla.

## Archivos clave
`backend/agente/contexto.py` · `backend/agente/api.py` (`_empresas_mencionadas`) · `app/screens/AsistenteScreen.js`
