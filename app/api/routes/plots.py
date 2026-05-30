from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Plot
from app.schemas.entities import PlotCreate, PlotRead
from app.services.crud import create_entity, get_or_404, list_entities

router = APIRouter()


@router.get("", response_model=list[PlotRead])
def list_plots(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)) -> list[Plot]:
    return list_entities(db, Plot, limit, offset)


@router.post("", response_model=PlotRead, status_code=status.HTTP_201_CREATED)
def create_plot(payload: PlotCreate, db: Session = Depends(get_db)) -> Plot:
    return create_entity(db, Plot, payload.model_dump(exclude_unset=True))


@router.get("/{plot_id}", response_model=PlotRead)
def get_plot(plot_id: UUID, db: Session = Depends(get_db)) -> Plot:
    return get_or_404(db, Plot, plot_id)

