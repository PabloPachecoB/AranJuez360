---
tags: [tecnico, seguridad]
---

# Seguridad

## Cuentas
- Contraseña ≥ 8 caracteres, con letras y números; validadores de Django (similitud, comunes, solo números).
- **Doble autenticación** obligatoria por correo en cada login → [[Registro y acceso]].
- Códigos: HMAC, 10 min, 5 intentos, reenvío cada 60 s; límite de 20 intentos/min por endpoint.
- Contraseñas temporales para cuentas creadas por el admin, con cambio obligatorio.
- La app guarda tokens solo en **SecureStore** (cifrado del sistema). La web, en `sessionStorage`.
- El admin no puede desactivarse a sí mismo.

## Antifraude de puntos
| Riesgo | Mitigación |
|---|---|
| Monto inflado | El cajero aprueba comparando con el ticket |
| Doble aprobación | `select_for_update` + solo desde PENDIENTE (real en PostgreSQL) |
| Captura del QR del cliente | QR firmado que vence en 2 minutos |
| Visitas repetidas | 1 visita con puntos por día (configurable) |
| QR de caja fotografiado | Código regenerable |
| Abuso de solicitudes | 1 pendiente por empresa, 3 por día, monto máximo |
| Otra empresa aprobando | El cajero solo ve su empresa |

## Producción
DEBUG=False, SECRET_KEY real, HTTPS, ALLOWED_HOSTS/CORS con dominio, Redis para límites compartidos, firewall, SSH con llave. Ver [[Despliegue VPS]].
