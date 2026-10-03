---
tags: [guia]
---

# Levantar en VS Code

## Abrir
1. VS Code → **File → Open Folder** → `C:\Users\pabli\Desktop\Aranjues`
2. Terminal: **Ctrl + ñ**

## Opción rápida
**Ctrl + Shift + P** → `Tasks: Run Task` → **Levantar todo** (abre 3 terminales). Detener: **Ctrl + C** en cada una.
*(El archivo `.vscode/tasks.json` está solo en esta PC.)*

## Opción manual (3 terminales)
```powershell
# 1) Backend
cd backend
.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8001

# 2) Web admin
cd web
npx vite --host

# 3) App (pulsa "w" para navegador, o escanea el QR con Expo Go)
cd app
npx expo start --port 8082
```

## Direcciones
| Qué | URL |
|---|---|
| Dashboard admin | http://localhost:3000 |
| App en navegador | http://localhost:8082 |
| App en celular | `exp://192.168.100.35:8082` (Expo Go, mismo Wi-Fi) |
| Admin de Django | http://localhost:8001/admin |

Cuentas → [[Cuentas de demo]] · El **código de verificación** sale en la terminal del backend.

## Comandos útiles (en `backend/`)
| Para qué | Comando |
|---|---|
| Pruebas | `.venv\Scripts\python.exe manage.py test usuarios empresas fidelizacion reportes` |
| Datos de demo | `.venv\Scripts\python.exe manage.py cargar_demo` |
| 60 días de actividad | `.venv\Scripts\python.exe manage.py cargar_actividad_demo --dias 60` |
| Migraciones | `.venv\Scripts\python.exe manage.py migrate` |

## Primera vez (clonando el repo)
```powershell
cd backend; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py cargar_demo
cd ..\web; npm install
cd ..\app; npm install; copy .env.example .env   # poner la IP de tu PC
```
Problemas → [[Problemas comunes]]
