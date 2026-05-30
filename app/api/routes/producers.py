from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Producer
from app.schemas.entities import ProducerCreate, ProducerRead
from app.services.crud import create_entity, get_or_404, list_entities

router = APIRouter()


@router.get("", response_model=list[ProducerRead])
def list_producers(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)) -> list[Producer]:
    return list_entities(db, Producer, limit, offset)


@router.post("", response_model=ProducerRead, status_code=status.HTTP_201_CREATED)
def create_producer(payload: ProducerCreate, db: Session = Depends(get_db)) -> Producer:
    return create_entity(db, Producer, payload.model_dump(exclude_unset=True))


@router.get("/{producer_id}", response_model=ProducerRead)
def get_producer(producer_id: UUID, db: Session = Depends(get_db)) -> Producer:
    return get_or_404(db, Producer, producer_id)

