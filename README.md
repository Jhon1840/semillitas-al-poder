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
SEEDDSS_API_URL=https://url-del-servicio-externo/analyze
SEEDDSS_API_KEY=token-opcional
SEEDDSS_IMAGES_FIELD=images
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-google-maps-api-key
```

El frontend manda las imagenes a:

```txt
POST /api/v1/seed-samples/external-analysis
```

Ese endpoint recibe `multipart/form-data`:

```txt
files: una o varias imagenes
sample_code: opcional
seed_lot_code: opcional
```

Si `SEEDDSS_API_URL` esta vacio, el backend responde en modo informativo indicando que falta configurar el servicio externo.

## Login

El formulario usa:

```txt
POST /api/v1/auth/login
```

Para crear un usuario de prueba puedes usar Swagger:

```txt
POST /api/v1/auth/register
```

## Rutas principales

```txt
GET  /api/v1/health

POST /api/v1/auth/register
POST /api/v1/auth/login
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

