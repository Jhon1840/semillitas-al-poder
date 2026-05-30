# NEXO Backend

Backend inicial para NEXO con FastAPI, PostgreSQL/PostGIS, Alembic, Redis y Celery.

## Stack

- FastAPI + Uvicorn
- PostgreSQL 16 + PostGIS
- SQLAlchemy 2
- Alembic
- Redis + Celery
- Pydantic
- httpx para APIs externas

## Levantar con Docker

```bash
docker compose up --build
```

En otra terminal, ejecutar migraciones:

```bash
docker compose exec api alembic upgrade head
```

La API queda disponible en:

```txt
http://localhost:8000
http://localhost:8000/docs
```

## Rutas principales

```txt
GET  /api/v1/health

POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me

GET  /api/v1/users
POST /api/v1/users

GET  /api/v1/producers
POST /api/v1/producers

GET  /api/v1/plots
POST /api/v1/plots

GET  /api/v1/campaigns
POST /api/v1/campaigns

GET  /api/v1/seed-samples
POST /api/v1/seed-samples
POST /api/v1/seed-samples/images
POST /api/v1/seed-samples/analysis-results

GET  /api/v1/weather/snapshots
POST /api/v1/weather/snapshots
POST /api/v1/weather/fetch/open-meteo

POST /api/v1/irrigation/calculate

GET  /api/v1/energy/pump-systems
POST /api/v1/energy/pump-systems
POST /api/v1/energy/calculate

POST /api/v1/agent/campaigns/{campaign_id}/context
GET  /api/v1/agent/contexts/{context_id}
```

## Flujo sugerido para probar

1. Crear usuario con `POST /auth/register`.
2. Crear productor.
3. Crear parcela.
4. Crear campana agricola.
5. Crear muestra de semilla.
6. Registrar imagen con URL.
7. Registrar resultado de analisis de semilla.
8. Crear o consultar clima.
9. Ejecutar calculo de riego.
10. Crear sistema de bombeo y calcular energia.
11. Generar contexto para agente.

## Migracion inicial

La migracion `202605300001_initial_schema.py` crea:

- 23 tablas del MVP.
- Extension PostGIS.
- Indices principales.
- Roles base.
- Coeficientes Kc iniciales para soya.
- Factores de calidad de semilla.
- Vistas `vw_campaign_current_status`, `vw_seed_analysis_summary`, `vw_irrigation_explanation` y `vw_pumping_summary`.

## Comandos utiles

```bash
docker compose exec api alembic upgrade head
docker compose exec api alembic downgrade base
docker compose exec api pytest
docker compose logs -f api
docker compose logs -f worker
```

