# Asistente de análisis (admin)

Chat de IA solo para el administrador (menú **Inteligencia y análisis → Asistente de análisis**, ruta `/asistente`).
Es el "Jarvis del admin": consulta datos reales, encuentra patrones y sugiere campañas. **Solo lectura.**

- Endpoint: `POST /api/v1/agente/admin/analisis/chat/` (permiso `EsAdmin`), body `{mensaje, historial}`.
- Código: `backend/agente/analisis.py` (herramienta `consultar_datos` con 15 temas: resumen, compras/visitas por día, horas pico, días de semana, ranking y negocios sin actividad, clientes frecuentes/dormidos, procedencia, edad y ocupación, mapa de clientes, pedidos, escenario/eventos, movimientos). Reutiliza `reportes.services`, `reportes.geografia` y `reportes.auditoria`.
- Reglas del prompt: toda cifra sale de una consulta, montos en bolivianos, indica el periodo, campañas con público/canal/momento y marca hipótesis. No expone correos.
- Web: `web/src/paseo360/pages/AsistenteAdmin.jsx` (sugerencias rápidas, muestra qué datos consultó).
- Tests: `AnalisisAdminTests` en `agente/tests.py` (solo admin, todos los temas, bucle con herramienta simulada).

No toca `Dashboard.tsx` ni el mapa (Codex). Ver [[Dashboard admin]] y [[Jarvis]].
