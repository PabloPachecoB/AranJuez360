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
- **Jarvis recomienda según el ánimo** ("estoy triste, ¿qué puedo comer?") con platos, precio y piso, y muestra las fichas con logo de los locales que nombra.
