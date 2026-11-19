# despliegue.md — Publicar FortínViajes en internet

Pila recomendada por la cátedra: **Neon** (PostgreSQL) → **Render** (API) → **Netlify** (frontend). Se hace en ese orden porque cada paso necesita la URL del anterior. Todos tienen plan gratuito.

> Nada de esto se ejecutó desde este repositorio: son pasos manuales de tu cuenta. Al terminar, tildá T15–T17 en `docs/tasks.md` y completá las URLs en el README y en `docs/informe-pruebas.md`.

## 1. Base de datos en Neon (T15)
1. Creá un proyecto en <https://neon.tech> y copiá la cadena de conexión (`postgresql://…?sslmode=require`).
2. Desde tu computadora, con la cadena en una variable de entorno (no en un archivo versionado):
   ```bash
   cd backend
   DATABASE_URL="<cadena de Neon>" npm run db:schema      # crea tablas, índices y trigger
   DATABASE_URL="<cadena de Neon>" npm run create-admin -- tu@email.com "UnaClaveLarga123" "Tu Nombre"
   ```
3. (Opcional) Cargá viajes de ejemplo: `psql "<cadena de Neon>" -f sql/seed.example.sql`.

## 2. API en Render (T15)
1. Subí el repositorio a GitHub (público) y en Render elegí **New → Blueprint** (usa `render.yaml`) o **New → Web Service** con:
   - Build command: `npm ci --include=dev && npm run build -w backend`
   - Start command: `npm run start -w backend`
   - Health check path: `/api/health`
2. Variables de entorno (panel de Render, **no** en el repo):
   | Variable | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | cadena de Neon |
   | `JWT_SECRET` | texto aleatorio de 32+ caracteres (`openssl rand -base64 48`) |
   | `FRONTEND_URL` | URL de Netlify (se completa en el paso 3), sin `/` final |
3. Verificá `https://<tu-api>.onrender.com/api/health` → `{"status":"ok",…,"database":"ok"}`.

## 3. Frontend en Netlify (T16)
1. **Add new site → Import from Git** con el mismo repositorio. `netlify.toml` ya define build y publicación.
2. Variable de entorno: `VITE_API_URL = https://<tu-api>.onrender.com/api`.
3. Volvé a Render y poné la URL de Netlify en `FRONTEND_URL` (permite el CORS). Redeploy de la API.

## 4. Prueba de punta a punta (T16)
1. Abrí la URL de Netlify, registrate como hincha, reservá un lugar.
2. Ingresá con el organizador, creá un viaje, registrá una seña y mirá el resumen.
3. Repetí el flujo desde el celular.

## Notas
- El plan gratuito de Render duerme la API tras ~15 min sin uso: la primera petición tarda hasta ~1 minuto (la app muestra un aviso).
- Para correr los tests contra una base propia necesitás una base **distinta** cuyo nombre incluya `test` (se vacía en cada corrida).
- Si cambiás el esquema, actualizá `backend/sql/schema.sql` (es idempotente) y volvé a ejecutar `npm run db:schema`.
- Rotá `JWT_SECRET` y la contraseña de la base si alguna vez se publicaron por error.
