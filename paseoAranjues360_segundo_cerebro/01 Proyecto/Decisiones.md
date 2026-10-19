---
tags: [proyecto, decisiones]
---

# Registro de decisiones

Formato: **fecha — decisión** · por qué.

## 2026-10-02
- **El proyecto pasa a llamarse Paseo Aranjuez 360.** · Se busca controlar varios módulos del Paseo, no solo un reto aislado. El documento base y el backend de TorreSegura son solo aceleradores → [[Visión y alcance]].
- **Foco en la vista administrativa.** · Es donde el Paseo toma decisiones.
- **No se ven los pedidos de las empresas.** · Cada empresa tiene sistemas aislados; la visibilidad comercial es solo vía fidelización.
- **Oficinas como bloque aparte, con invitaciones QR.** → [[Oficinas e invitaciones]]
- **Reto elegido: Reto 1, Paseo Points.** · El PDF exige elegir uno; encaja con lo que construimos.
- **Cada empresa tiene su propio QR/NFC de caja.** · El cliente lo escanea, ve nombre y logo, ingresa **NIT + monto**, confirma con huella → solicitud **pendiente** → el **cajero la compara con el ticket y acepta o rechaza**. → [[Fidelización]]
- **Alta de empresas por el admin con credenciales por correo** (contraseña temporal + cambio obligatorio). → [[Empresas]]
- **Roles definidos:** admin, porteros, clientes (principales), negocio (negocio + emprendimiento), oficinas (alquilan y dan servicios aparte). Se mantiene **cajero** dentro de negocio. → [[Roles]]
- **Punto por visita**: el portero registra el ingreso del cliente → +1 punto, máximo 1 visita con puntos por día (configurable). QR del cliente **dinámico** (vence en 2 min) para que una captura no sirva.
- **Se quita "irregularidades/antifraude" del dashboard.** · Decisión del usuario.
- **Historial por cliente**: en qué tiendas tiene más tickets de fidelización. → [[Dashboard admin]]
- **Dos interfaces:** web (admin/negocio/oficina) y app (cliente/portero).
- **Registro del cliente**: correo y celular separados, **CI obligatorio** (aviso: debe ser real porque se pide al entregar premios), NIT opcional, contraseña ≥ 8 con letras y números, verificación de correo por código, **doble autenticación** en cada login y **acceso directo con huella**. → [[Registro y acceso]]
- **Se reutilizó la app Expo existente** (estructura, apiClient, SecureStore) corrigiendo seguridad y errores.
- **Merge a `main` del repositorio del equipo** conservando su estructura (`docs/`, READMEs). → [[Equipo y repositorio]]
- **Monedero arriba en la app**: monedas, saldo, barra hacia la siguiente recompensa y cuánto falta (pts y ≈ Bs). → [[Monedero y recompensas]]
- **Base de datos recomendada para producción: PostgreSQL** en VPS con Docker. → [[Despliegue VPS]]
- **Puertos locales:** backend 8001, web 3000, app 8082. · 8000 lo usa otro proyecto; 5173 está reservado por Windows. → [[Problemas comunes]]

## 2026-10-03
- **Directorio organizado por tipo → rubro.** · Para que Jarvis busque más rápido y la app filtre mejor. Rubros: Comida, Electrónica, Servicios, Ropa, Cosméticos, Concesionaria, Banca, Otros. **Tigo → Servicios.** Oficinas y emprendimientos siguen como tipos aparte. → [[Directorio y rubros]]
- **Se cargan las 70 tiendas reales de paseoaranjuez.com** con logos y fotos; 69 cuentas demo (HOY HAY sin cuenta). → [[Directorio y rubros]]
- **Primera oficina real elegida: CONSESO** (seguros, Torre II piso 6, of. 610-611; dirección confirmada en su sitio oficial). Aún no cargada. La oficina "Patiño" no está confirmada. → [[Fuentes de datos reales]]
- **Cartelera y eventos reales en lugar de los ficticios** (Cinema Lounge y El Club del Mercado Gastronómico); se actualizan a mano cada semana. → [[Diversión (cartelera y eventos)]]
- **Menús con precios referenciales** en los 23 restaurantes ("pon un precio cualquiera, investiga un poco"): los locales no publican cartas; se calibró con precios de Cochabamba. → [[Comer y pedidos (PaseoYa)]]
- **PaseoYa entra en la app como sección "Comer"**: el cliente pide y recoge en el local; el negocio gestiona desde el panel web que ya existía. Aclaración sobre la decisión del 2026-10-02: el **admin** sigue sin ver pedidos; cada negocio ve solo los suyos.
- **Los atajos de la app abren pantallas reales**, no el chat de Jarvis (Comer, Tiendas, Promos, Mapa, Servicios, ofertas, eventos). Jarvis queda en el buscador, el botón central y "Preguntar a Jarvis". → [[Jarvis (asistente IA)]]
- **Logo oficial "360 Paseo Aranjuez" recreado en SVG** (3 + 6 + sello como 0, franja con el nombre). → [[Logo y animación de entrada]]
- **El login abre con una animación**: las torres del Paseo se dibujan en perspectiva y se transforman en el logo 360. Registro y desbloqueo usan el sello con brillo.
- **Precios referenciales en cine y eventos**, cargados desde el admin: Cinema Lounge Bs 40 (Bs 35 en las funciones familiares del domingo); eventos entre libre y Bs 120. La fuente no publica precios. → [[Diversión (cartelera y eventos)]]
- **Pósters oficiales** (Wikipedia) en las 5 películas, subidos por `admin/peliculas`.
- **Se suma la agenda de El Cuarto by Paseo (piso 4)** a la de El Club; la hora se estima cuando la publicación no la da.
- **El detalle del evento pasa a ser una hoja con diseño** (antes era una alerta del sistema).
- **IP local de desarrollo: 192.168.0.11** (`app/.env`, `backend/.env`). → [[Problemas comunes]]
- **Jarvis recomienda según el ánimo** ("estoy triste, ¿qué puedo comer?") con platos, precio y piso, y muestra las fichas con logo de los locales que nombra.

## 2026-10-04
- **Nuevo módulo Escenario abierto**: cualquier cliente pide un espacio del Paseo para presentarse (música, podcast, taller…); el admin aprueba según disponibilidad y lo publica con acceso libre o con cupos; cada reserva da una entrada con QR que valida la portería. → [[Escenario abierto]]
- **Choques de horario**: no se puede pedir ni aprobar un espacio ocupado por otro evento; el admin ve también las solicitudes que piden el mismo horario.
- **Reglas**: 1 día de anticipación, máx. 6 h, máx. 3 solicitudes en revisión por persona, 1–4 cupos por reserva, la entrada vale una sola vez.
- **4 espacios iniciales** tomados de lugares reales del Paseo (El Club, Cinema Lounge, El Cuarto, Galería de Arte); capacidades estimadas.
- **"Gratis" en vez de "Entrada libre"** cuando un evento no cobra pero exige reservar cupo (para no confundir).
- **Registro con edad y ocupación obligatorias** (fecha de nacimiento + estudiante de colegio / universitario / profesional / otro) para segmentar clientes en el dashboard. → [[Registro y acceso]]
- **La web deja de llamarse "PaseoYa"**: título, login (con el logo 360) y menú del negocio dicen **Paseo Aranjuez 360**; PaseoYa queda como el módulo de pedidos "Comer". Un cliente que entra a la web ve que su lugar es la app.
- **PaseoYa con pago QR simulado y retiro presencial obligatorio** (sin delivery, según el PDF): estados Esperando pago → Pagado → Confirmado → Preparando → Listo → Cliente en el Paseo → Entregado; QR de cobro de 15 min que abre un "Banco Simulado"; solo negocios de comida; si el negocio cancela un pedido pagado se marca reembolso simulado. → [[Comer y pedidos (PaseoYa)]]
- **Pedir desde la ficha del restaurante y reservar la hora de retiro**: compra ahora (paga con QR) y retira lo antes posible o a la hora reservada (hasta 3 días). Se cobra el precio de promoción vigente. → [[Comer y pedidos (PaseoYa)]]
- **Jarvis pide comida y reserva cupos de eventos** (con confirmación y pago QR en el chat) y dice claramente lo que no puede hacer (comprar no-comida, delivery, eventos de acceso libre). → [[Jarvis (asistente IA)]]
- **Jarvis dice los precios en "bolivianos"** (no "Bs") para que la voz se entienda.
- **App del portero reducida a Escanear + Eventos + Cartelera** (se quitó la pestaña "Hoy" de visitas a oficinas); 3 porteros por defecto en `cargar_demo`. → [[Roles]]
- **El administrador sí supervisa los pedidos de PaseoYa** (página Pedidos y retiros): el PDF lo pide en 5.7. Antes solo los veía cada negocio. Corrige la decisión del 2026-10-02 para este módulo.
- **HOY HAY ya tiene cuenta** (`demo.hoyhay@paseo.bo`), pedido del usuario para validar su panel.
- **Diseño web unificado** en azul marino + dorado (la paleta del admin y de la app); se retira el terracota de PaseoYa. Oficinas con el mismo menú que negocios. → [[Diseño unificado de la web]]
- **Menú del admin completo**: se quita "Jarvis" y las demás opciones (Categorías, Representantes, Equipo, Reportes, Auditoría, Configuración) tienen página con datos reales. La auditoría se arma con lo que ya registra cada módulo, sin tabla nueva.

## 2026-10-18
- **Billetera Paseo con proveedores externos**: no manejamos dinero ni la seguridad de los pagos. Una pasarela boliviana cobra (QR/tarjeta, dinero directo a cada negocio) y un motor de gift cards/cashback guarda el saldo de regalo; la app del Paseo solo muestra y pide por API. Los puntos siguen siendo nuestros. → [[Billetera Paseo (saldo de regalo)]]
