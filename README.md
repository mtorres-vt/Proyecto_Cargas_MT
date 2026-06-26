# Control_Bases_VRT

Sistema de control de datos para SQL Server 2008. Muestra el diccionario de datos (columnas, tipo y tamaño) de las bases en el servidor y permite navegar por base y tabla. El alcance inicial está centrado en la base **FILIPINAS**.

## Requisitos
- Node.js (versión moderna recomendada para Vite y dependencias; la versión actual instalada no soporta TLS moderno para npm)
- Acceso a SQL Server 2008 en `192.168.1.22`

Nota: en esta PC hay dos instalaciones de Node (x86 y x64). Para que funcione `npm install`, debes usar el Node x64 en `C:\Program Files\nodejs`.

En PowerShell (por ejemplo, terminal de VS Code) puedes forzarlo para la sesión actual con:
- `$env:Path = "C:\Program Files\nodejs;" + $env:Path`
- `node -v` y `npm -v` (deben mostrar versiones modernas)

## Backend
1. Configura las variables en [backend/.env](backend/.env).
2. Instala dependencias:
   - `npm install` dentro de la carpeta `backend`.
3. Inicia el API:
   - `npm run dev` en `backend`.

## Frontend
1. Configura la URL del API en [frontend/.env](frontend/.env).
2. Instala dependencias:
   - `npm install` dentro de la carpeta `frontend`.
3. Inicia Vite:
   - `npm run dev` en `frontend`.

## Endpoints disponibles
- `GET /api/databases`
- `GET /api/databases/:database/tables`
- `GET /api/databases/:database/tables/:table/columns`

## Próximos pasos
- Conectar con el servidor de producción `192.168.1.9` para comparar diccionarios.
- Agregar relación y mapeo entre bases origen y destino.
