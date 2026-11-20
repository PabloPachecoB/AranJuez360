# Plan de pruebas — Panel de negocio (web)

Usuario: `cafearanjuez@paseo.bo` (rol NEGOCIO, "Café Aranjuez", Piso 1 · Local 12), datos de `cargar_demo`.
Seed: `tests/seed.spec.ts` (sesión iniciada, aterriza en `/productos`).
Plan hecho explorando la app en vivo el 2026-10-19.

## 1. Acceso

### 1.1 Login con código de verificación
1. Ir a `/`, completar Correo y Contraseña, clic en **Continuar**.
2. Escribir el código de 6 dígitos del correo, clic en **Ingresar**.
- Esperado: redirige a `/productos`, encabezado "Café Aranjuez · Piso 1 · Local 12".

### 1.2 Contraseña incorrecta
1. Login con contraseña errónea.
- Esperado: mensaje de error, se queda en el formulario de credenciales.

### 1.3 Código incorrecto
1. Credenciales correctas, código `000000`.
- Esperado: mensaje "Código inválido" (o similar) y no entra al panel.

### 1.4 Cerrar sesión
1. Clic en **Cerrar sesión** (menú lateral).
- Esperado: vuelve al formulario de login.

## 2. Productos (`/productos`)

### 2.1 Listado inicial
- Esperado: tabla con **Capuchino** (Bs 22.00) y **Chocolate caliente** (Bs 25.00), ambos "Sin stock",
  contador "Mostrando 2 de 2 productos", chips Total: 2 / Activos: 2.

### 2.2 Crear producto
1. Clic en **Nuevo producto** → modal "Nuevo producto".
2. Nombre "Latte Vainilla 350ml", precio 28, stock 10, clic en **Guardar**.
- Esperado: el producto aparece en la tabla con Bs 28.00 y Total: 3.

### 2.3 Validación al crear
1. Abrir el modal y clic en **Guardar** sin nombre.
- Esperado: no se guarda; el campo obligatorio se marca.

### 2.4 Cancelar creación
1. Abrir el modal, escribir un nombre, clic en **Cancelar**.
- Esperado: el modal se cierra y la tabla no cambia.

### 2.5 Buscar
1. Escribir "Capu" en "Buscar producto por nombre...".
- Esperado: solo se ve Capuchino.

### 2.6 Filtros
1. Estado → "Pausados" con todos activos.
- Esperado: tabla vacía. Volver a "Estado: Todos" muestra 2.
2. Promoción → "Con descuento activo".
- Esperado: solo productos con promoción.

### 2.7 Pausar en la app
1. Desactivar "Mostrar Capuchino en la app".
- Esperado: Activos baja a 1; recargando la página se mantiene.

### 2.8 Editar producto
1. **Editar** en Chocolate caliente, cambiar precio a 27, guardar.
- Esperado: la tabla muestra Bs 27.00.

### 2.9 Eliminar producto
1. **Eliminar** en un producto creado por la prueba (confirmar si se pide).
- Esperado: desaparece de la tabla.

## 3. Pedidos (`/pedidos`)

### 3.1 Estado vacío
- Esperado: "No hay pedidos entrantes por ahora.", contadores en 0, Facturado hoy Bs 0.

### 3.2 Validar retiro con código inexistente
1. Escribir un código falso en "Validar retiro de cliente", clic en **Validar y Entregar**.
- Esperado: mensaje de error, ningún pedido cambia.

> Pendiente: flujo completo cliente crea pedido → negocio prepara → entrega (requiere crear pedido vía API como cliente).

## 4. Mi negocio (`/negocio`)

### 4.1 Resumen de ventas
- Esperado: Total vendido Bs 0, Pedidos entregados 0 (sin pedidos en la base de prueba).

### 4.2 Editar información comercial
1. Completar Teléfono y Referencia de llegada, clic en **Guardar cambios**.
- Esperado: confirmación; la vista previa muestra la referencia en lugar de "Sin referencia"; persiste al recargar.

## 5. Caja (`/caja`)

### 5.1 Pestañas
- Esperado: pestañas Por aprobar / Aprobadas / Rechazadas; "No hay compras por aprobar".

### 5.2 Cupón inexistente
1. Escribir un código falso en "Entregar un premio canjeado", clic en **Buscar**.
- Esperado: mensaje de cupón no encontrado.

## 6. Recompensas (`/recompensas`)

### 6.1 Catálogo de canje
- Esperado: "Capuchino gratis", 760 monedas, Bs 22, Visible; equivalencia 1.000 monedas = Bs 30.

### 6.2 Publicar producto
1. Clic en **Publicar producto**, elegir Chocolate caliente, guardar.
- Esperado: aparece en "Mi catálogo de canje".

## 7. Ofertas (`/ofertas`)

### 7.1 Listado
- Esperado: "2x1 en capuchinos", Bs 22, Activo.

### 7.2 Agregar oferta
1. **Agregar oferta**, completar nombre, precio y vigencia, guardar.
- Esperado: aparece en "Mis ofertas" como Activo.

## 8. Horarios (`/horarios`)

### 8.1 Guardar horario
1. Marcar Domingo como cerrado y cambiar el cierre del Lunes a 20:00, clic en **Guardar horarios**.
- Esperado: confirmación; `/negocio` refleja el horario nuevo.

## 9. Ficha pública (`/ficha`)

### 9.1 Guardar ficha
1. Completar Lema e Instagram (URL válida), clic en **Guardar ficha**.
- Esperado: confirmación; persiste al recargar.

### 9.2 URL inválida
1. Instagram = "no-es-url", guardar.
- Esperado: error de validación.

### 9.3 Ver mi página
- Esperado: **Ver mi página ↗** abre `/sitio/<id>` con el nombre del negocio.

## Observaciones durante la exploración

- `/negocio` muestra el horario con segundos ("10:00:00–21:00:00"); probablemente debería ser "10:00–21:00".
- `/negocio` lista Lun–Sáb pero no muestra Domingo (¿cerrado o falta?).
