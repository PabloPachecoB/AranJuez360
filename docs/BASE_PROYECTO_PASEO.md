# Base del proyecto: Hackathon by Paseo Aranjuez

Este archivo es el contexto común de nuestro equipo. Todos trabajamos sobre esta misma base para que las tres partes encajen al final.

## Cómo usar este archivo

1. Pega este archivo completo al inicio de la conversación con tu IA.
2. Dile qué persona eres (1 a 6) y en qué módulo trabajas.
3. Pídele que respete los nombres de tablas, campos, estados y rutas tal como están aquí. Si la IA propone cambiarlos, no lo aceptes sin avisar al equipo.

**Instrucción para la IA que lea esto:** estás ayudando a un integrante de un equipo de 6 personas. Usa exactamente los nombres de tablas, campos, estados y rutas definidos en este documento. No renombres ni agregues campos por tu cuenta: si hace falta un cambio, indícalo como propuesta para que el equipo lo apruebe. Genera solo el código del módulo de la persona que te habla. El objetivo es un MVP demostrable, no un producto terminado.

## 1. Qué estamos construyendo

Una plataforma para Paseo Aranjuez (un paseo comercial con tiendas, restaurantes, oficinas y servicios) con tres módulos que comparten un solo backend y una sola base de datos:

| Módulo | Qué hace | Rol en la entrega |
|---|---|---|
| **PaseoYa** | Marketplace: el cliente compra desde el celular y recoge en el Paseo | Reto principal |
| **Paseo Points** | Fidelización: cada compra suma puntos canjeables | Integración |
| **Jarvis Paseo** | Asistente con IA que recomienda productos, promociones y eventos | Integración |

Dos interfaces:

- **App (cliente):** marketplace, pedidos, puntos y chat con Jarvis.
- **Web (negocio y administrador):** gestión de productos, promociones, pedidos, recompensas y estadísticas.

## 2. Reglas que no se rompen

1. **Retiro presencial obligatorio.** No hay delivery. El cliente recoge su pedido en el Paseo.
2. **Los puntos se suman cuando el pedido pasa a `entregado`,** no antes. Un pedido suma puntos una sola vez.
3. **El negocio escanea el QR del pedido del cliente.** Ese escaneo marca la entrega y dispara los puntos.
4. **Jarvis no inventa.** Solo responde con datos de la base (negocios, productos, promociones, eventos, cupones). Si no tiene el dato, lo dice.
5. **Los descuentos de Jarvis son cupones reales** de la tabla `cupones`, que el negocio puede validar.
6. **Un pedido pertenece a un solo negocio.** Si el carrito tiene productos de varios negocios, se crea un pedido por negocio, cada uno con su código de retiro.

## 3. Stack

| Parte | Tecnología |
|---|---|
| App cliente | React Native |
| Web negocio y admin | React + Vite |
| Backend / API | POR DEFINIR |
| Base de datos | POR DEFINIR |
| Modelo de IA para Jarvis | POR DEFINIR |
| Repositorio | GitHub (un solo repositorio para todo el equipo) |

Estructura de carpetas del repositorio:

```
/app      -> React Native (cliente)
/web      -> React + Vite (negocio y admin)
/backend  -> API y base de datos
/docs     -> este archivo y la presentación
```

Forma de trabajo en GitHub: cada persona trabaja en su propia rama (ej. `persona1-app-catalogo`) y la une a `main` cuando su parte funciona. Nadie sube cambios directo a `main`.

Supuesto para el MVP (confirmar en equipo): el pago es simulado, el pedido se crea como pagado sin pasarela real.

## 4. Modelo de datos

Nombres en minúscula y con guion bajo. Todas las tablas tienen `id` y `creado_en`.

### usuarios
| Campo | Tipo | Nota |
|---|---|---|
| nombre | texto | |
| email | texto | único |
| celular | texto | |
| password_hash | texto | |
| rol | texto | `cliente`, `negocio` o `admin` |
| negocio_id | referencia a negocios | solo si rol es `negocio` |
| puntos_saldo | entero | empieza en 0 |

### categorias
| Campo | Tipo |
|---|---|
| nombre | texto |

### negocios
| Campo | Tipo | Nota |
|---|---|---|
| nombre | texto | |
| categoria_id | referencia a categorias | |
| descripcion | texto | |
| piso | texto | |
| local | texto | número de local |
| referencia | texto | cómo llegar |
| horario | texto | ej. "Lun a Sáb 10:00 a 21:00" |
| logo_url | texto | |
| activo | booleano | |

### productos
| Campo | Tipo | Nota |
|---|---|---|
| negocio_id | referencia a negocios | |
| nombre | texto | |
| descripcion | texto | |
| precio | decimal | en bolivianos |
| foto_url | texto | |
| stock | entero | |
| en_promocion | booleano | |
| precio_promocion | decimal | vacío si no hay promoción |
| activo | booleano | |

### pedidos
| Campo | Tipo | Nota |
|---|---|---|
| cliente_id | referencia a usuarios | |
| negocio_id | referencia a negocios | |
| total | decimal | |
| estado | texto | ver sección 5 |
| codigo_retiro | texto | único, se muestra como QR |
| cupon_id | referencia a cupones | opcional |
| entregado_en | fecha y hora | vacío hasta la entrega |

### pedido_items
| Campo | Tipo |
|---|---|
| pedido_id | referencia a pedidos |
| producto_id | referencia a productos |
| cantidad | entero |
| precio_unitario | decimal |

### movimientos_puntos
| Campo | Tipo | Nota |
|---|---|---|
| cliente_id | referencia a usuarios | |
| negocio_id | referencia a negocios | opcional |
| pedido_id | referencia a pedidos | opcional |
| puntos | entero | positivo si gana, negativo si canjea |
| tipo | texto | `ganado` o `canjeado` |

### recompensas
| Campo | Tipo | Nota |
|---|---|---|
| nombre | texto | |
| descripcion | texto | |
| costo_puntos | entero | |
| negocio_id | referencia a negocios | vacío si aplica en todo el Paseo |
| activo | booleano | |

### cupones
| Campo | Tipo | Nota |
|---|---|---|
| cliente_id | referencia a usuarios | |
| recompensa_id | referencia a recompensas | opcional |
| codigo | texto | único |
| descripcion | texto | ej. "20% en Café X" |
| estado | texto | `activo`, `usado` o `vencido` |
| usado_en | fecha y hora | |

### eventos
| Campo | Tipo |
|---|---|
| nombre | texto |
| descripcion | texto |
| fecha | fecha |
| hora | hora |
| lugar | texto |

### configuracion
| Campo | Tipo | Nota |
|---|---|---|
| clave | texto | ej. `puntos_por_boliviano` |
| valor | texto | valor inicial: `1` |

## 5. Estados del pedido

Usar exactamente estos valores, en este orden:

```
recibido -> confirmado -> preparando -> listo_para_recoger -> entregado
```

- `cancelado` puede ocurrir antes de `listo_para_recoger`.
- El documento oficial menciona también "Cliente llegó al Paseo". Es opcional; si se implementa, el valor es `cliente_llego` y va entre `listo_para_recoger` y `entregado`.

## 6. API (propuesta de rutas)

Todas devuelven JSON. Las rutas protegidas reciben el token del usuario.

### Autenticación (persona 3)
| Método y ruta | Qué hace |
|---|---|
| POST /auth/registro | Crea un usuario cliente |
| POST /auth/login | Devuelve token y datos del usuario |
| GET /yo | Datos del usuario actual, incluido `puntos_saldo` |

### PaseoYa (personas 1 y 2)
| Método y ruta | Qué hace | Quién la usa |
|---|---|---|
| GET /categorias | Lista de categorías | cliente |
| GET /negocios | Lista de negocios, filtro por categoría | cliente, Jarvis |
| GET /negocios/:id | Detalle de un negocio | cliente, Jarvis |
| GET /productos?buscar=&negocio_id=&en_promocion= | Buscador global y catálogo | cliente, Jarvis |
| POST /productos | Crear producto | negocio |
| PUT /productos/:id | Editar producto, foto, precio, stock o promoción | negocio |
| DELETE /productos/:id | Quitar producto | negocio |
| POST /pedidos | Crear pedido desde el carrito | cliente |
| GET /pedidos | Mis pedidos (cliente) o pedidos de mi negocio (negocio) | ambos |
| PUT /pedidos/:id/estado | Cambiar estado | negocio |
| POST /pedidos/validar-retiro | Recibe `codigo_retiro`, marca `entregado` y suma puntos | negocio |

### Paseo Points (personas 3 y 4)
| Método y ruta | Qué hace | Quién la usa |
|---|---|---|
| GET /puntos/movimientos | Historial del cliente | cliente |
| GET /recompensas | Catálogo de recompensas | cliente, Jarvis |
| POST /recompensas/:id/canjear | Resta puntos y crea un cupón | cliente |
| GET /cupones | Cupones del cliente | cliente, Jarvis |
| POST /cupones/validar | Recibe `codigo`, lo marca `usado` | negocio |
| POST /recompensas, PUT /recompensas/:id | Gestionar recompensas | admin |
| PUT /configuracion/puntos_por_boliviano | Cambiar la regla de puntos | admin |
| GET /admin/estadisticas | Clientes frecuentes, negocios con más actividad, ventas | admin |

### Jarvis (personas 5 y 6)
| Método y ruta | Qué hace |
|---|---|
| POST /jarvis/chat | Recibe el mensaje y el historial, devuelve la respuesta y, si aplica, una lista de productos o negocios para mostrar como tarjetas |
| GET /eventos | Eventos del Paseo |

## 7. Módulos y responsables

### PaseoYa
**Idea base:** "Compra desde tu celular, recoge en el Paseo."

- **Persona 1, app del cliente:** inicio con categorías y promociones, lista de negocios, catálogo por negocio, buscador global, carrito, mis pedidos con estado y QR de retiro.
- **Persona 2, panel web del negocio:** mis productos (crear, editar, borrar, foto, stock), poner o quitar promoción, pedidos entrantes con cambio de estado, escanear QR para entregar.
- **Empezar por:** el panel de productos, para que la app tenga datos que mostrar.

### Paseo Points
**Idea base:** "Cada compra en cualquier negocio del Paseo suma en una sola cuenta."

- **Persona 3, backend y líder técnico:** base de datos, login, API compartida, lógica de puntos.
- **Persona 4, pantallas de puntos y panel admin:** saldo, historial, catálogo de recompensas, canje, validación de cupones, y panel del administrador.
- **Regla inicial:** Bs 1 = 1 punto, leído de `configuracion`.
- **Empezar por:** base de datos y login, porque los otros equipos dependen de eso.
- **Extra si sobra tiempo:** niveles Bronce, Plata y Oro según puntos acumulados.

### Jarvis Paseo
**Idea base:** "Un asistente que conoce todo el Paseo y recomienda según lo que necesitas o cómo te sientes."

- **Persona 5, IA:** el bot con herramientas que consultan la base.
- **Persona 6, chat y presentación:** interfaz del chat en la app, tarjetas de producto que llevan a PaseoYa, pruebas, diapositivas y guion de la demo.
- **Herramientas del bot:**
  - `buscar_productos(texto, categoria)`
  - `ver_promociones()`
  - `info_negocio(nombre)` (ubicación, horario, descripción)
  - `eventos(fecha)`
  - `mis_puntos_y_cupones(cliente_id)`
- **Comportamiento:** entiende la intención, no solo palabras. Ante "necesito un regalo" o "estoy triste" propone opciones reales del Paseo con ubicación y precio, y menciona promociones o cupones si existen.
- **Ejemplo:**
  - Usuario: "Estoy triste, ¿qué me recomiendas?"
  - Jarvis: "Lamento que estés así. Un chocolate caliente en [negocio] (piso 1, local 12) puede ayudar, y hoy está en promoción. Además tienes un cupón disponible. ¿Te lo dejo listo para recoger?"
- **Empezar por:** el bot con los datos de prueba cargados a mano, sin esperar a los otros equipos.

## 8. Recorrido de la demo

Este es el flujo que une los tres módulos y el que mostraremos en vivo:

1. El cliente le escribe a Jarvis lo que necesita.
2. Jarvis recomienda un producto real con su negocio, precio y ubicación.
3. El cliente lo compra en PaseoYa y recibe su QR de retiro.
4. El negocio confirma y marca el pedido como `listo_para_recoger`.
5. El cliente va al Paseo y muestra el QR.
6. El negocio lo escanea: el pedido pasa a `entregado` y se suman los puntos.
7. El cliente ve sus puntos y canjea una recompensa.

## 9. Datos de prueba

Todos usamos los mismos datos de prueba. Son ficticios hasta tener los negocios reales del Paseo.

- 3 categorías: Comida, Tecnología, Moda.
- 2 negocios por categoría, cada uno con piso, local y horario.
- 4 a 5 productos por negocio, al menos uno en promoción.
- 2 eventos.
- 3 recompensas (300, 500 y 1000 puntos).
- 1 usuario de cada rol: cliente, negocio y admin.

## 10. Prioridades

1. Flujo completo de PaseoYa: ver producto, pedir, QR, entregar.
2. Puntos al entregar y un canje.
3. Jarvis recomendando con datos reales de la base.
4. Extras: niveles, voz, estadísticas avanzadas, notificaciones.

## 11. Entregables que pide la hackathon

1. Prototipo funcional.
2. Código fuente en repositorio.
3. Presentación: problema, solución, usuarios, propuesta de valor, funcionamiento, arquitectura, tecnologías, posible implementación.
4. Demostración en vivo.
5. Explicación de la arquitectura: frontend, backend, base de datos, APIs, IA y servicios externos.
