# Copilot Instructions (Control_Bases_VRT)

## Big picture
- `frontend/` es una app Vite + React para navegar bases/tablas y ver el diccionario de datos.
- `backend/` es un API Express que consulta metadatos de SQL Server (2008) vía `mssql`.
- Alcance actual: listar bases del servidor y, al entrar, ver tablas/columnas (tipo de dato y tamaño). El foco inicial es `FILIPINAS` (tablas `exportaciones_2025` e `importaciones_2025`).

## Flujo de ejecución (dev)
- Importante: hay Node x86 y x64 instalados. Para que `npm install` funcione, usa el Node x64 de `C:\Program Files\nodejs`.
- En PowerShell (VS Code), para la sesión actual: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
- Backend: `cd backend` → `npm install` → `npm run dev` (API en `http://localhost:4000`).
- Frontend: `cd frontend` → `npm install` → `npm run dev` (Vite en `http://localhost:5173`).
- Tareas VS Code: [.vscode/tasks.json](../.vscode/tasks.json) tiene `backend: dev` y `frontend: dev`.

## Backend: patrones y convenciones
- Config de DB en [backend/.env](../backend/.env); carga con `dotenv/config` en [backend/src/index.js](../backend/src/index.js).
- Endpoints principales:
  - `GET /api/databases`
  - `GET /api/databases/:database/tables`
  - `GET /api/databases/:database/tables/:table/columns`
- Metadatos: usa `INFORMATION_SCHEMA.TABLES` y `INFORMATION_SCHEMA.COLUMNS` en [backend/src/db.js](../backend/src/db.js).
- Seguridad: no interpolar identificadores SQL sin validación; el nombre de base se valida con `assertSafeIdentifier`.

## Frontend: patrones y convenciones
- Base URL del API desde `VITE_API_URL` en [frontend/.env](../frontend/.env).
- Cliente HTTP en [frontend/src/api.js](../frontend/src/api.js) (axios).
- UI principal en [frontend/src/App.jsx](../frontend/src/App.jsx) (chips de bases + selector de tablas + tabla de columnas).

## Secrets
- No subir credenciales. Los `.env` están ignorados por [.gitignore](../.gitignore).
