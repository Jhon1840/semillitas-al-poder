from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.entities import IrrigationCalculationRequest, IrrigationCalculationResponse
from app.services.irrigation_service import calculate_irrigation

router = APIRouter()


@router.post("/calculate", response_model=IrrigationCalculationResponse, status_code=status.HTTP_201_CREATED)
def calculate(payload: IrrigationCalculationRequest, db: Session = Depends(get_db)) -> IrrigationCalculationResponse:
    calculation, recommendation = calculate_irrigation(db, payload)
    return IrrigationCalculationResponse(calculation=calculation, recommendation=recommendation)

