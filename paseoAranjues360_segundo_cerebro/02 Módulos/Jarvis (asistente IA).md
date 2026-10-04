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
- **Acciones con confirmación** (botón Confirmar en el chat): reservar cine, canjear recompensas, cancelar reservas y, desde 2026-10-04:
  - **Pedir comida** (`pedir_comida`): "Cómprame una hamburguesa doble bacon" → pregunta cuántas y si es para ya o a qué hora → propone "Pedir 1 Hamburguesa doble bacon en Bypass Burger (piso 3) por Bs 52… Lo pagas con QR" → al confirmar se abre el **QR de pago en el mismo chat** y el pedido sigue en Comer → Mis pedidos.
  - **Reservar cupos en eventos con cupos** (`reservar_cupo_evento`): devuelve el código y la **entrada con QR** en el chat (también queda en Diversión → Escenario).
- **Precios en bolivianos**: todo lo que Jarvis dice o escribe pasa por `en_bolivianos()` (`agente/voz.py`): "Bs 52" → "52 bolivianos" (y "Bs 1" → "1 boliviano"), para que la voz no deletree "be ese".
- **Fotos de los platos en el chat** (2026-10-04): bajo el globo salen tarjetas con foto, nombre, local, precio y botón **Pedir** de los platos que Jarvis nombró (se asigna cada plato al local mencionado más cercano en la frase). Se quedan al salir del modo voz.
- **Nunca promete sin herramienta**: si el modelo escribe "te dejo el pedido…" sin llamar a la herramienta (pasó con el capuchino de HOY HAY: no se creó ningún pedido ni botón Confirmar), el backend lo reintenta una vez; si aun así no la llama, responde "No logré dejar la solicitud lista…" (`guardrails.promete_accion_sin_herramienta`).
- **No inventa platos**: HOY HAY no tiene capuchino; ahora lo dice y ofrece lo que sí hay.
- **Dice con claridad lo que no puede**: comprar lo que no es comida (indica el local y piso), delivery, pagar por el usuario, reservar eventos de acceso libre ("no hace falta reservar; se paga en el lugar").
- Los platos de los restaurantes y los eventos van con `[id]` en el contexto; si el modelo repite un `[id]`, el backend lo borra antes de mostrarlo o leerlo en voz alta.
- Probado con la IA real (Qwen cloud, 2026-10-04): hamburguesa → propuesta correcta; audífonos → "no puedo comprar productos que no sean comida" + dónde comprarlos (y la recompensa real de 9170 monedas); Brunch Sinfónico → "acceso libre, pagas en el lugar".
- No inventa locales en rubros vacíos ni convierte monedas a Bs.

## Dónde se usa Jarvis en la app
Buscador del Inicio, botón central (modo voz), tarjeta "Hablar con Jarvis", botón "Preguntar a Jarvis" en fichas y eventos. Los atajos (Comer, Tiendas, Promos, Mapa, Servicios) **ya no** abren el chat: van a su pantalla.

## Archivos clave
`backend/agente/contexto.py` · `backend/agente/api.py` (`_empresas_mencionadas`) · `app/screens/AsistenteScreen.js`
