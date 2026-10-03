# PaseoYa Web

Aplicación web del módulo PaseoYa. El código se organiza por tipo de usuario:

```text
src/
  App.tsx                 # Aplicación y rutas
  main.tsx                # Entrada
  api/                    # Cliente HTTP, autenticación y servicios compartidos
  auth/                   # Login y sesión compartida
  admin/                  # Administración (TypeScript + Tailwind)
  empleado/               # Panel de negocio: páginas, componentes, contextos y API
  cliente/                # Área del usuario cliente
```

El panel admin existente ya está integrado en esta app y usa la misma sesión
compartida. El área de cliente tiene su entrada preparada para desarrollar sus
pantallas. Después del segundo paso de autenticación, PaseoYa usa el rol
devuelto por el backend: `ADMIN` abre administración, `NEGOCIO` abre el portal
de negocio/empleado y `CLIENTE` abre el área de cliente.

Para iniciar este frontend:

```powershell
npm run dev
```

Desde la raíz del repositorio, entra a `web`. El backend Django
debe estar disponible en `http://127.0.0.1:8001`.
