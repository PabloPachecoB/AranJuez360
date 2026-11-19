# Carga local de tiendas y accesos demo

Se utilizó `importar_tiendas_paseo` con la copia de 70 tiendas de
`backend/empresas/datos/tiendas_paseo_aranjuez.json`. Las cuentas se crearon
reutilizando el método `_usuario` de `cargar_demo`, sin ejecutar la carga
completa de datos ficticios ni enviar invitaciones.

- 69 cuentas con rol NEGOCIO, vinculadas a su tienda.
- HOY HAY (Hoy Hay Café) queda sin cuenta demo por indicación del usuario.
- Usuarios y contraseñas: `ACCESOS_DEMO_TIENDAS.csv`.
- Contraseña de prueba: `Paseo2026!`.
- Ejemplos: `demo.brochetaking@paseo.bo` y `demo.appleland@paseo.bo`.
- El inicio de sesión conserva su segundo paso: el código aparece en la
  terminal del backend local, conforme a la configuración demo existente.
- Se comprobó la autenticación de las 69 cuentas mediante Django.
- Carga final: 70 logos, 68 fotos de galería y 12 portadas. Se verificó la
  integridad de los 150 archivos de imagen y que las galerías coincidan con
  la fuente, respetando el límite de ocho fotos por tienda del importador.

## Datos pendientes de confirmar

Los siguientes WhatsApp tienen una longitud inusual en la fuente y se
conservaron sin inventar una corrección:

| Negocio | Número de la fuente |
| --- | --- |
| BELU Boutique | 591616848490 |
| Bolivia Fitness | 591692070330 |
| Chotto Matte | 591760976020 |

Siete tiendas no incluyen WhatsApp y 58 no incluyen fotos de galería en la
copia original. No se inventaron esos datos. Los correos de contacto
`@tiendas.paseo.bo` generados por el importador son marcadores, no correos
reales verificados; las cuentas de prueba usan `demo.…@paseo.bo`.

La base local conserva las ocho empresas demo que ya existían; esta carga
agrega las 70 fichas reales. No se modificaron las cuentas anteriores ni se
publicaron cambios en GitHub.

## Organización por tipo y rubro

`python manage.py organizar_rubros` normaliza los negocios y emprendimientos
sin cambiar su tipo ni sus cuentas; las oficinas mantienen su especialidad.
El importador utiliza la misma clasificación para futuras cargas.

Las 70 tiendas reales quedan en Comida (23), Electrónica (2), Servicios (1,
Tigo), Ropa (20, incluye calzado), Cosméticos (6) y Otros (18). Banca y
Concesionaria están disponibles sin establecimientos asignados. Las categorías
anteriores sin establecimientos activos no aparecen en el directorio público.

Jarvis recibe el directorio agrupado por tipo y rubro, incluyendo oficinas,
con un máximo de 80 establecimientos activos. Las descripciones ayudan a
identificar especialidades dentro de Otros. Los filtros aceptan términos
como `electronica`, `tecnologia` y `moda` mediante alias.

Validación: 42 pruebas de empresas y agente aprobadas; las 69 cuentas demo
se conservan y HOY HAY sigue sin cuenta.
