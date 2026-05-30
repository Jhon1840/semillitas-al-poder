from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from httpx import HTTPError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import WeatherSnapshot
from app.schemas.entities import WeatherFetchRequest, WeatherSnapshotCreate, WeatherSnapshotRead
from app.services.crud import create_entity, get_or_404, list_entities
from app.services.weather_service import fetch_open_meteo_snapshot

router = APIRouter()


@router.get("/snapshots", response_model=list[WeatherSnapshotRead])
def list_weather_snapshots(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)) -> list[WeatherSnapshot]:
    return list_entities(db, WeatherSnapshot, limit, offset)


@router.post("/snapshots", response_model=WeatherSnapshotRead, status_code=status.HTTP_201_CREATED)
def create_weather_snapshot(payload: WeatherSnapshotCreate, db: Session = Depends(get_db)) -> WeatherSnapshot:
    return create_entity(db, WeatherSnapshot, payload.model_dump(exclude_unset=True))


@router.get("/snapshots/{snapshot_id}", response_model=WeatherSnapshotRead)
def get_weather_snapshot(snapshot_id: UUID, db: Session = Depends(get_db)) -> WeatherSnapshot:
    return get_or_404(db, WeatherSnapshot, snapshot_id)


@router.post("/fetch/open-meteo", response_model=WeatherSnapshotRead, status_code=status.HTTP_201_CREATED)
async def fetch_weather(payload: WeatherFetchRequest, db: Session = Depends(get_db)) -> WeatherSnapshot:
    try:
        return await fetch_open_meteo_snapshot(db, payload)
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo consultar Open-Meteo: {exc}") from exc

