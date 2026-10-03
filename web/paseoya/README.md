# PaseoYa Web

Aplicación web del módulo PaseoYa. El código se organiza por tipo de usuario:

```text
src/
  App.tsx                 # Aplicación y rutas
  main.tsx                # Entrada
  api/                    # Cliente HTTP, autenticación y servicios compartidos
  auth/                   # Login y sesión compartida
  admin/                  # Área de administración
  empleado/               # Panel de negocio: páginas, componentes, contextos y API
  cliente/                # Área del usuario cliente
```

El panel admin existente permanece por ahora en `web/src`, dentro de su
proyecto Vite separado. Las carpetas `admin` y `cliente` de esta app quedan
preparadas para integrar esas áreas en una siguiente etapa.

Para iniciar este frontend:

```powershell
npm run dev
```

Desde la raíz del repositorio, primero entra a `web/paseoya`. El backend Django
debe estar disponible en `http://127.0.0.1:8001`.
