# NEXO

Monorepo inicial para NEXO con backend FastAPI y frontend Next.js.

El primer flujo visible es simple: landing de presentacion, login y subida de imagenes de semillas para enviarlas al servicio externo configurado en el backend.

## Stack

Backend:

- FastAPI + Uvicorn
- PostgreSQL 16 + PostGIS
- SQLAlchemy 2
- Alembic
- Redis + Celery
- httpx para APIs externas

Frontend:

- Next.js
- React
- TypeScript
- lucide-react

Documentacion especifica del frontend:

- [frontend/README.md](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/README.md)

## Levantar con Docker

```bash
docker compose up --build
```

En otra terminal, ejecutar migraciones:

```bash
docker compose exec api alembic upgrade head
```

URLs:

```txt
Frontend: http://localhost:3000
Backend:  http://localhost:8000
Swagger:  http://localhost:8000/docs
```

Redis queda disponible solo dentro de Docker como `redis:6379`; no publica el puerto `6379` en Windows para evitar conflictos.

## Servicio externo de semillas

Configura en `.env`:

```txt
SEEDDSS_API_URL=http://10.10.35.127:8000/
SEEDDSS_API_KEY=token-opcional
SEEDDSS_IMAGES_FIELD=files
SEEDDSS_LOGIN_PATH=/api/login
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SEEDDSS_API_URL=http://10.10.35.127:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-google-maps-api-key
```

El frontend manda las imagenes a:

```txt
POST /api/v1/seed-samples/external-analysis
```

Ese endpoint recibe `multipart/form-data`:

```txt
files: una o varias imagenes
sample_id: opcional
generated_by: opcional
observations: opcional
session_id: opcional, solo si se quiere guardar reporte dentro del wizard SeedDSS
```

El backend NEXO reenvia esas imagenes a `POST {SEEDDSS_API_URL}/api/analyze_group`. Si se envia `session_id`, tambien intenta guardar el reporte en `POST {SEEDDSS_API_URL}/api/save_report`, porque esa API exige una sesion del wizard.

## Login

El formulario usa:

```txt
POST /api/v1/auth/seeddss-login
```

Este endpoint de NEXO hace proxy contra la API de SeedDSS en `POST {SEEDDSS_API_URL}{SEEDDSS_LOGIN_PATH}` con JSON. Por defecto usa `POST http://10.10.35.127:8000/api/login`. No usa el login local de NEXO.

Importante: en el codigo Flask de SeedDSS, la ruta API es `/api/login` y el servidor se levanta por defecto en el puerto `8000`.

## Rutas principales

```txt
GET  /api/v1/health

POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/seeddss-login
GET  /api/v1/auth/me

POST /api/v1/seed-samples/external-analysis

GET  /api/v1/seed-samples
POST /api/v1/seed-samples
POST /api/v1/seed-samples/images
POST /api/v1/seed-samples/analysis-results
```

## Comandos utiles

```bash
docker compose exec api alembic upgrade head
docker compose exec api pytest
docker compose logs -f api
docker compose logs -f frontend
docker compose exec frontend npm run typecheck
```

