---
tags: [pendientes, roadmap]
actualizado: 2026-10-03
---

# Pendientes

## ▶️ Ahora — en este orden (2026-10-03)
1. [ ] **Revisar y fusionar el PR #7** `integracion-equipo → master` ([enlace](https://github.com/PabloPachecoB/AranJuez360/pull/7)). Pedir revisión a Alan (PaseoYa) y Jhoestar (mapa/sidebar). Sin conflictos.
2. [ ] **Avisar al equipo** qué trae el PR y los comandos para cargar datos → [[Cuentas de demo]] · [[Equipo y repositorio]]
3. [ ] **Probar todo en el teléfono** (`npx expo start -c --port 8082`, IP nueva 192.168.0.11): **animación del login**, Inicio "Para comer", Comer → pedido → avanzarlo desde el panel web → ver el cambio en la app, fichas con fotos, Jarvis "estoy triste…", Diversión (pósters y detalle del evento). Hasta ahora solo se probó en Expo web y por API.
4. [ ] **App: pantalla Beneficios** — la pestaña solo baja a "Tus monedas". Backend listo: catálogo, canjear, mis cupones y mis reservas de cine (`directorioService.js`) → [[Monedero y recompensas]]
5. [ ] **App: historial de movimientos** (API `puntos/movimientos/` lista, falta pantalla)
6. [x] ~~Precios de cine y eventos~~: cargados desde el admin como **referenciales** + pósters + agenda de El Cuarto (2026-10-03) → [[Diversión (cartelera y eventos)]]
7. [ ] **Cargar CONSESO** como primera oficina real → [[Fuentes de datos reales]]
8. [x] ~~Jarvis sin LLM~~: funciona con Qwen cloud (`qwen3.8-flash`, probado 2026-10-04). Antes:: en las pruebas salió "cuota agotada" (Qwen) y ElevenLabs sin créditos. Levantar Ollama con `qwen3:8b` o cargar saldo antes de la demo → [[Jarvis (asistente IA)]]
9. [ ] **Gestión de cajeros por la empresa** (crear/desactivar): no hay API; hoy se crean desde el admin de Django
10. [ ] **Presentación y demo** (ver sección 🎤) + **APK con EAS** para mostrar en el teléfono sin Expo Go.
11. [ ] **Billetera Paseo** (2026-10-18, en planificación): responder las decisiones abiertas y luego construir la fase 1 → [[Billetera Paseo (saldo de regalo)]]
12. [ ] **Ofertas 2x1 no se aplican al cobrar** (2026-10-19): "2x1 en capuchinos" de Café Aranjuez está vigente, pero el pedido cobra precio × cantidad (el 04/10 Jarvis armó 2 capuchinos por Bs 44). Decidir: estructurar las ofertas (tipo 2x1 / % / precio fijo) para que el backend las aplique, o que Jarvis aclare que la oferta es solo en el local → [[Comer y pedidos (PaseoYa)]]

## 🔴 Prioridad 1 — mínimo del PDF
- [x] Canje de recompensas en backend: descontar monedas → cupón → validar en caja (y Jarvis puede canjear con confirmación)
- [ ] Canje desde una pantalla de la app (ver ▶️ 4)
- [x] App: sumar compra — escanear QR/NFC de caja → NIT + monto (`EscanearScreen`)
- [x] App: visita por NFC de la puerta / actividades (`EscanearScreen`)
- [ ] App: historial de movimientos (ver ▶️ 5)
- [x] Web: panel de la empresa — ficha, horarios, catálogo, recompensas, QR, caja, cajeros, visitas (`web/src/paseo360/empresa/`)
- [x] App: modo portero (`PorteriaScreen`)
- [ ] Confirmar si "Mi QR" del cliente (renovación cada 2 min) sigue en el alcance o lo reemplaza el NFC de la puerta

## 🟡 Prioridad 2 — completar el 360
- [ ] **Oficinas: invitaciones QR** → [[Oficinas e invitaciones]] (responder preguntas abiertas)
- [ ] Web admin: pantallas de porteros, recompensas y configuración de puntos (revisar qué cubre `Monedas.jsx`)
- [x] Eventos reales en la app → [[Diversión (cartelera y eventos)]]
- [x] Pantalla web de cartelera y eventos: ya existía (`Diversion.jsx`); ahora con cupos y espacio
- [x] **Escenario abierto** (2026-10-04): propuestas desde la app, aprobación del admin según disponibilidad, cupos con QR, portería → [[Escenario abierto]]
- [ ] Escenario abierto: notificación push al aprobar/rechazar (hoy es por correo) y contador de pendientes en el menú del admin
- [ ] Confirmar con el Paseo qué espacios se pueden prestar y su capacidad real
- [ ] Promociones del Paseo administrables por el admin (hoy solo ofertas de cada negocio)
- [ ] Dashboard: invitados por oficina, promociones, exportar Excel/PDF
- [x] Directorio de tiendas en la app → [[Directorio y rubros]]
- [x] Marketplace Comer + pedidos con panel web → [[Comer y pedidos (PaseoYa)]]

## 🟢 Extras que suman (PDF 3.9)
- [ ] Promociones y eventos dirigidos por edad u ocupación (los datos ya se piden en el registro)
- [ ] Pantalla en la app para que los clientes antiguos completen edad y ocupación (la API `PATCH auth/yo/` ya acepta `ocupacion`)
- [ ] Niveles Bronce/Plata/Oro/Platinum
- [ ] Puntos dobles en fechas especiales · bono de cumpleaños
- [ ] Bono por visitar negocios distintos · misiones/logros
- [x] Asistente IA (Jarvis) con datos reales → [[Jarvis (asistente IA)]]
- [ ] Notificaciones push ("tu pedido está listo", avisos del Paseo; la campana del Inicio aún dice "pronto")

## 🗂️ Datos reales
- [x] Fotos en las 4 promociones de hoy (2026-10-04): fotos libres de Wikimedia Commons (hamburguesa, capuchino, audífonos, alfajores). El Inicio y el Directorio ahora **muestran** la imagen de la oferta (antes solo un ícono). Son promos de negocios *demo*: reemplazar por las fotos reales cuando cada negocio suba las suyas.
- [ ] Confirmar en persona la oficina **Patiño** y el resto de oficinas halladas → [[Fuentes de datos reales]]
- [ ] Precios reales de menús, cine y eventos (hoy **referenciales**; confirmar con cada local)
- [ ] Hora real de los eventos de El Cuarto (la publicación no la da; se estimó 21:00 y 11:00)
- [ ] Actualizar cada semana la agenda del Cinema Lounge, El Club **y El Cuarto** (`agenda_paseo.json` → `importar_agenda_paseo`)
- [ ] Sello del logo en alta resolución para calcarlo fiel (hoy es una versión simplificada) → [[Logo y animación de entrada]]
- [ ] Fotos reales por plato (hoy se reparten fotos del local)
- [ ] Horarios de las 70 tiendas reales (sin horarios la app no muestra abierto/cerrado)
- [ ] Revisar 3 WhatsApp con longitud rara (BELU Boutique, Bolivia Fitness, Chotto Matte)
- [x] Commit y push de lo del 2026-10-03 (`95cd469`, rama `integracion-equipo`, PR #7)

## ⚙️ Producción
- [x] Docker Compose (Django + PostgreSQL + Caddy) desplegado en `179.236.240.61` → [[Despliegue VPS]]
- [ ] **Actualizar el VPS** (corre la versión del 2026-10-04; faltan los commits de `deploy/vps-setup`)
- [ ] En el servidor: correr los comandos de carga (las imágenes `mediafiles/` no van en git) y servir `/media/` con Caddy
- [ ] SMTP real para correos
- [x] HTTPS con sslip.io (https://179-236-240-61.sslip.io) · [ ] dominio propio
- [ ] Build de la app con EAS (APK para la demo)
- [ ] Redis como caché (sin él, el límite de intentos de login no se comparte entre workers) y correos en segundo plano
- [ ] Revisar el aviso de facturación de la cuenta de GitHub (aparece arriba en el repo)

## 📢 Equipo
- [ ] Avisar del cambio de enfoque PaseoYa → Paseo Aranjuez 360 → [[Equipo y repositorio]]
- [x] Subir a GitHub monedero + recompensas (incluido en el PR #7)
- [ ] Decidir si `docs/ACCESOS_DEMO_TIENDAS.csv` (69 cuentas demo) se comparte con el equipo por otro medio (no está en git)
- [ ] ⚠️ Agregar `docs/ACCESOS_DEMO_TIENDAS.csv` y `docs/paseo_*_revision.*` al `.gitignore`: hoy un `git add .` los subiría

## 🎤 Presentación
- [ ] Diapositivas: problema, solución, usuarios, propuesta de valor, funcionamiento, arquitectura, tecnologías, implementación → [[Reglas de la hackathon]]
- [ ] Guion de la demo en vivo. Propuesta: cliente entra → "Para comer" → Jarvis "estoy triste…" → pide en Comer → el negocio lo avanza en la web → la app muestra "¡Tu pedido está listo!" → suma monedas en caja → canjea
