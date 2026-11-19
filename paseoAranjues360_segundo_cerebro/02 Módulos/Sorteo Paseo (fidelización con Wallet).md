---
tags: [modulos, fidelizacion, wallet, sorteo, planificacion]
estado: planificación
actualizado: 2026-11-13
---

# Sorteo Paseo (fidelización con Wallet)

> **Actualización 2026-11-17 — decisión vigente:** cada negocio escanea la Wallet, verifica el monto y el comprobante de su local y aprueba la compra. El admin del Paseo supervisa y audita. Esto sustituye las indicaciones históricas de esta nota que exigen un validador del mall o dicen que los negocios solo registran. La prueba de Google Wallet sí existe; el circuito completo de compras aún no. La guía de implementación vigente es `docs/FIDELIZACION_EQUIPO.md`, en el mismo repositorio, con ramas `feature/fidelizacion-frontend` y `feature/fidelizacion-backend` hacia `integracion-equipo`.

> **Idea:** el cliente acumula **1 punto por cada Bs 200** de compras validadas en los comercios del Paseo, y cada punto le da **una participación en el sorteo**. La tarjeta vive en **Apple Wallet y Google Wallet** y se usa desde antes de que salga la app. Referencia: el módulo de tarjetas Wallet de UPilot (ThinkUSoft). Nada implementado todavía.

## ⚠️ El riesgo principal
Un empleado registra una venta real y se asigna los puntos a sí mismo o a un familiar. En [[Fidelización]] (`SolicitudPuntos`), hoy **el mismo cajero aprueba**, así que en este módulo la acreditación pasa a un **validador del mall, que debe ser otra persona**.
- El QR no frena este fraude: un cómplice puede confirmar en su celular.
- Lo que sí lo frena: la validación por otra persona, las alertas por patrones (un cajero que concentra compras en pocas cuentas, muchas cargas tardías o correcciones) y la verificación del ganador por alguien independiente antes de entregar el premio.

## ✅ Decisiones (2026-11-13)
- **Dónde va:** dentro del panel web de negocio que ya existe (`web/src/paseo360/empresa/EmpresaApp.jsx`, `CajeroApp.jsx`). La validación va en el admin del mall. No es un panel aparte.
- **Wallet entra sí o sí** desde el piloto (Apple y Google).
- **QR del pase:** solo un código opaco y revocable (ej. `PA-7K3M9X`), con el mismo código en texto debajo. Es fijo en los dos sistemas para el piloto; en Android se puede activar el rotativo más adelante. Al escanearlo, el cajero ve solo el primer nombre y las iniciales.
- **Tarjeta antes que la app:** registro en una web pública (QR en el mostrador). La cuenta `cliente_fidelizacion` es independiente y tiene un enlace opcional al `Usuario` de la app; al vincular no se mueve el saldo y el pase sigue siendo el mismo.
- **Registro:** pide **correo y celular** (los dos obligatorios) y el cliente **elige con cuál verificarse**.
  - Solo un dato verificado sirve para entrar, recuperar la tarjeta y vincularla.
  - Un dato sin verificar no bloquea a nadie: si su dueño real lo verifica, se quita de la otra cuenta.
  - Vinculación con la app: mismo correo → un toque; si no, código al celular. Una tarjeta, una cuenta de la app; los cambios y las fusiones los revisa el mall.
- **Cálculo:** acumulado con sobrante, compartido entre locales de la campaña. Siempre se recalcula desde el total validado: `puntos = floor(total / 200)` y lo que sobra queda guardado.
  - Ej.: Bs 380 → 1 punto y Bs 180 guardados («te faltan Bs 20»).
  - Caso de aceptación: Bs 150 + Bs 80 → 1 punto, 1 participación y Bs 30 guardados. Repetir un comprobante no cambia nada. Devolver la de Bs 80 → Bs 150 guardados y la participación anulada.
- **Avisos** (por Wallet desde el piloto; correo o WhatsApp al dato verificado; push cuando salga la app):
  1. Al validar cada compra. Es también un control: si alguien usa la cuenta sin permiso, el cliente se entera. Este aviso no se puede apagar.
  2. Cuando le faltan **Bs 40 o menos**, una sola vez por punto.
  3. **3 días antes** del cierre del sorteo.
  - Máximo uno al día de promoción. Los avisos promocionales se pueden apagar. En la pantalla bloqueada solo se muestran montos y puntos, nunca el local ni lo comprado.

## ⚙️ Configuración de la campaña: se define una sola vez (decisión 2026-11-13)
El admin del mall define las reglas según su estrategia **antes de lanzar** la campaña. Al lanzarla quedan **fijas y no se tocan más**.

| Parámetro | Valor inicial sugerido |
|---|---|
| Bs por punto | 200 |
| Monto mínimo por compra | Bs 20 |
| Tope de participaciones por cliente | 50 |
| Monto que pide revisión extra | Bs 3.000 |
| Lo que sobra al cierre | pasa a la siguiente campaña |
| Avisos: «te falta poco» y días antes del cierre | Bs 40 · 3 días |
| Fechas de inicio, cierre y sorteo | — |

Ciclo de la campaña:
1. **Borrador:** el admin edita libremente y ve una vista previa (ej. «Bs 380 = 1 punto, guarda Bs 180»).
2. **Lanzar:** pantalla de confirmación con el resumen de reglas («después no se pueden cambiar»). Queda en Auditoría quién lanzó y cuándo.
3. **Activa:** reglas bloqueadas; el sistema rechaza cualquier cambio, también por API. Si se equivocaron o quieren otra estrategia, se crea **una campaña nueva**.
4. **Cerrada:** se congela la lista de participaciones y se sortea.

- Única acción de emergencia sugerida: **pausar** (deja de registrar compras nuevas, por ejemplo ante un fraude), sin cambiar ninguna regla. Queda registrada con motivo.
- Las reglas se muestran en la página pública y en el pase, para que el cliente sepa con qué reglas participa.

## 📱 Qué muestra el pase (aprobado 2026-11-13)
- **Frente:** puntos (arriba, grande), participaciones, «te faltan Bs X», compras pendientes, fecha del sorteo, QR y el código en texto.
- **Reverso (Apple) / detalle (Google):** últimas compras validadas, reglas de la campaña y enlace a su página.
- Al registrar una compra solo sube «pendientes»; al validarla suben los puntos y llega el aviso; una devolución baja los puntos y avisa el motivo.
- Nunca muestra qué compró ni en qué local: eso va en el historial de la web y luego en la app.

## 👥 Quién hace qué (decisión 2026-11-13)
- **Solo el admin del Paseo Aranjuez administra la fidelización:** crea y lanza campañas, valida compras, resuelve excepciones (cargas tardías, cambios de titular, devoluciones), revisa alertas, cierra el sorteo y verifica al ganador.
- **Los negocios (dueño y cajeros) solo registran compras** de su local desde el panel de negocio: escanear QR, folio, monto y foto. No validan, no acreditan puntos y no ven compras de otros locales.
- Recomendación: si el Paseo tiene varios admins, que quien registre una excepción no sea quien la apruebe (queda en Auditoría).

## ✅ Más decisiones (2026-11-13)
- **Paseo Points de la app:** no se tocan. Siguen como están hasta definir la estrategia; el sorteo es un sistema aparte.
- **Credenciales de Wallet de ThinkUSoft** (cambio del mismo día: «no importa el emisor»). Se usa el emisor de Google Wallet de ThinkUSoft, **aprobado para publicar el 2026-11-12**, y el pase lleva el nombre y el logo de Paseo Aranjuez. Para iPhone, la cuenta de Apple Developer de ThinkUSoft cuando exista.
  - Los pases no se pueden mover a otro emisor: si algún día cambia, los clientes vuelven a guardar la tarjeta. Conviene dejar en el acuerdo con el Paseo quién es dueño de los datos.
  - El ID del emisor y la llave de la cuenta de servicio no van en git ni en notas: van en las variables del servidor.

## 🗺️ Plan del piloto (estimado, 1 desarrollador)
| Fase | Qué incluye | Estimado |
|---|---|---|
| **0 · Trámites** (en paralelo) | ✅ Google Wallet: emisor de ThinkUSoft aprobado · cuenta Apple Developer de ThinkUSoft (99 USD), Pass Type ID y certificado · proveedor de WhatsApp/SMS para los códigos | días, depende de Apple y del proveedor |
| **1 · Núcleo en el backend** | Campaña (borrador → activa → pausada → cerrada, reglas bloqueadas) · cuenta de fidelización · compras con clave única · evidencia · movimientos · participaciones · devoluciones · cambios con aprobación · auditoría · permisos · pruebas del caso de aceptación, duplicados en paralelo (PostgreSQL) y devoluciones | 1,5–2 semanas |
| **2 · Pantallas web** | Registro público con elección de verificación · caja en `CajeroApp` (escanear QR, folio, monto, foto) · admin: crear y lanzar campaña, cola de validación, excepciones | 1,5–2 semanas |
| **3 · Wallet y avisos** | Google: clase y objeto de lealtad, botón para guardar, actualizaciones · Apple: firma del pase, servicio de registro de dispositivos, push por APNs · los tres avisos · prueba en iPhone y Android reales (incluye revisar el QR negro) | 1,5–2 semanas |
| **4 · Antifraude y sorteo** | Alertas por patrones · cierre con lista congelada (hash) · sorteo · verificación del ganador · pruebas e2e | ~1 semana |
| **Después · vinculación con la app** | Ofrecer la tarjeta al crear la cuenta, verificar correo o celular y enlazar | 3–5 días, cuando salga la app |

Total: **~6–8 semanas de desarrollo**, con los trámites corriendo en paralelo desde el primer día. A ThinkUSoft solo se le pediría, opcionalmente, su código de generación y actualización de pases como referencia (es TypeScript; Paseo es Django).

## 🎨 Tarjeta «viva» (2026-11-13)
- Wallet no permite animaciones dentro de la tarjeta (ni Google ni Apple). En su lugar:
  1. **Banner de progreso por cliente** (aprobado; diseño final aprobado el mismo día, se mantienen también las filas de puntos y «te faltan» arriba): puntos acumulados en grande + barra hacia el siguiente punto («Bs 130 / 200 · te faltan Bs 70») + participaciones. Se regenera en cada compra validada. Código: `backend/fidelizacion/wallet_banner.py` (Pillow + Manrope OFL en `fidelizacion/fuentes/`).
  2. **Banners por momento** de la campaña (lanzamiento, «faltan 3 días», ganador), cambiando la clase.
  3. Animaciones de verdad en la página de registro y, después, en la app.
- **Logo (aprobado):** el logo 360. `web/public/logo-360-sello-wallet.png` (sello dorado, para el círculo y para iPhone) y `web/public/logo-360-ancho-wallet.png` (360 completo, encabezado en Android, variable `GOOGLE_WALLET_LOGO_ANCHO_URL`).
- **Maqueta aprobada** de frente y reverso en Android e iPhone. iPhone: banner como franja, reverso con socio, últimas compras (fecha, monto y estado, sin local), «Cómo sumar» y enlaces.
- Para el banner por cliente hace falta publicar las imágenes en una URL pública **imposible de adivinar** y sin datos personales.
- Probado en Google Wallet el 2026-11-13: la tarjeta se actualiza sola en el teléfono al cambiarla por la API (`ClienteWallet` en `wallet_google.py`).

## 📓 Bitácora 2026-11-13: qué hicimos y por qué
| Qué | Por qué |
|---|---|
| Se diseñó el sorteo (1 punto cada Bs 200 con sobrante acumulado) a partir del módulo de UPilot | UPilot solo tiene sellos por compra con un premio fijo; el Paseo necesita puntos por monto, validación diferida y sorteo |
| La acreditación pasa al admin del Paseo; los negocios solo registran | El riesgo principal es que un empleado se asigne puntos a sí mismo o a un familiar; hoy en `SolicitudPuntos` el mismo cajero aprueba |
| Wallet obligatorio desde el piloto, antes que la app | El Paseo quiere que los clientes acumulen ya; la cuenta de fidelización se vincula a la app después, con correo o celular verificado |
| Reglas de la campaña fijas al lanzar | Cambiarlas a mitad del sorteo cambiaría las participaciones de todos; para otra estrategia, campaña nueva |
| Emisor de Google de ThinkUSoft (aprobado 2026-11-12) | Ya está aprobado para publicar; el pase lleva la marca del Paseo. Los pases no se pueden mover de emisor |
| La llave de la cuenta de servicio está en `C:\Users\pabli\.upilot\upilot-wallet.json` (fuera del repo) y el Issuer ID solo en `backend/.env` | Para que nunca entren a git; el Issuer ID se obtuvo preguntándole a la API con esa llave |
| Tarjeta probada en Google Wallet real (clase de prueba `paseo_sorteo_prueba`, pase `PA-TEST01`) | Se comprobó que el QR sale bien (no negro) y que **el pase se actualiza solo** al cambiarlo por la API |
| Frente con dos filas (puntos/participaciones y te faltan/pendientes/sorteo) | Al personalizar el frente, Google deja de mostrar los puntos solos; hay que ponerlos explícitos |
| Banner de progreso por cliente en lugar de animación | Ni Google ni Apple permiten animaciones; la barra que se llena compra a compra da la sensación de tarjeta viva |
| Fuente Manrope en el banner | La fuente de Pillow no tiene tildes («participación» salía con un cuadrado) |
| Logo 360 (sello dorado + 360 ancho) | Elegido por el usuario; el sello encaja en el círculo del logo y el 360 ancho va en el encabezado de Android |
| Commit `477ebe1` en `integracion-equipo` (sin push) | Solo archivos del Wallet; los cambios pendientes del usuario quedaron fuera |

**Bloqueado / pendiente**
- **Logo y banners por cliente sin publicar:** hace falta subirlos al VPS. Desde Claude Code no hubo acceso (el sistema bloqueó entrar a producción). Hasta entonces la tarjeta real muestra el ícono temporal.
- **iPhone:** falta la cuenta de Apple Developer (99 USD). La maqueta está aprobada; no hay código de pases de Apple todavía.
- **Fase 1:** campañas, registro de compras en el panel de negocio, validación en el admin y actualización del pase al validar.

## ❓ Por confirmar
1. **Envío del código al celular:** WhatsApp, SMS o ambos, y su costo.
2. **Lista de empleados y familiares** para las reglas de elegibilidad: quién la mantiene.

## Evidencia para validar una compra
| Evidencia | ¿Suficiente sola? |
|---|---|
| Folio fiscal verificable | Sí, si coincide con el reporte |
| Línea del reporte detallado de ventas (folio, monto, hora, caja) | Sí |
| Foto del comprobante revisada por personal del mall | Sí, con revisión humana |
| Confirmación del cliente en el celular | No, solo complementa |
| Total diario del comercio | **No**: sirve para conciliar montos globales, no para validar una compra |

Ver también: [[Fidelización]] · [[Seguridad]] · [[Billetera Paseo (saldo de regalo)]] · [[Pendientes]]
