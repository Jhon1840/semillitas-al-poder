from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import PumpSystem
from app.schemas.entities import (
    EnergyCalculationRequest,
    EnergyCalculationResponse,
    PumpSystemCreate,
    PumpSystemRead,
)
from app.services.crud import create_entity, get_or_404, list_entities
from app.services.energy_service import calculate_energy

router = APIRouter()


@router.get("/pump-systems", response_model=list[PumpSystemRead])
def list_pump_systems(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)) -> list[PumpSystem]:
    return list_entities(db, PumpSystem, limit, offset)


@router.post("/pump-systems", response_model=PumpSystemRead, status_code=status.HTTP_201_CREATED)
def create_pump_system(payload: PumpSystemCreate, db: Session = Depends(get_db)) -> PumpSystem:
    return create_entity(db, PumpSystem, payload.model_dump(exclude_unset=True))


@router.get("/pump-systems/{pump_system_id}", response_model=PumpSystemRead)
def get_pump_system(pump_system_id: UUID, db: Session = Depends(get_db)) -> PumpSystem:
    return get_or_404(db, PumpSystem, pump_system_id)


@router.post("/calculate", response_model=EnergyCalculationResponse, status_code=status.HTTP_201_CREATED)
def calculate(payload: EnergyCalculationRequest, db: Session = Depends(get_db)) -> EnergyCalculationResponse:
    calculation, recommendation = calculate_energy(db, payload)
    return EnergyCalculationResponse(calculation=calculation, recommendation=recommendation)

