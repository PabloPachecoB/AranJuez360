---
tags: [proyecto, roles]
---

# Roles

| Rol | Quién es | Qué hace | Dónde |
|---|---|---|---|
| **ADMIN** | Administración del Paseo | Crea empresas y porteros, configura puntos y recompensas, ve todo el [[Dashboard admin]] | Web |
| **PORTERO** | Guardia de la entrada | Su app tiene solo 3 pestañas: **Escanear** (QR del cliente → visita; invitación a oficina; entrada a evento con cupos), **Eventos** disponibles (libres o con cupos) y **Cartelera** de cine. Nada más. | App (modo portero) |
| **CLIENTE** ⭐ | Usuario principal | Gana puntos por visitas y compras, canjea recompensas | App |
| **NEGOCIO** | Negocio **o** emprendimiento | Ficha, productos, ofertas, QR/NFC de caja, aprueba compras | Web |
| **CAJERO** | Personal de caja de un negocio | Solo atiende solicitudes de puntos (sin acceso a la ficha) | Web (tablet/celular) |
| **OFICINA** | Empresa que alquila y brinda sus servicios aparte | Ficha y servicios; **sin caja de puntos**; genera invitaciones QR | Web |

## Reglas
- Las cuentas de NEGOCIO, OFICINA y PORTERO las crea el **admin**; reciben usuario y contraseña temporal por correo y deben cambiarla al primer ingreso.
- Los CLIENTES se registran solos desde la app → [[Registro y acceso]].
- Tipos de empresa: `NEGOCIO`, `EMPRENDIMIENTO`, `OFICINA` → [[Empresas]].
- El rol de la cuenta responsable sale del tipo: oficina → `OFICINA`; negocio/emprendimiento → `NEGOCIO`.

## Dos interfaces
- 🖥️ **Web** (React + Vite): admin, negocios, cajeros, oficinas.
- 📱 **App** (React Native + Expo): clientes y porteros.
Ver [[Arquitectura]].
