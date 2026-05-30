from typing import Any, TypeVar
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


def get_or_404(db: Session, model: type[ModelT], entity_id: UUID) -> ModelT:
    entity = db.get(model, entity_id)
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{model.__name__} no encontrado",
        )
    return entity


def list_entities(db: Session, model: type[ModelT], limit: int = 100, offset: int = 0) -> list[ModelT]:
    return list(db.scalars(select(model).offset(offset).limit(limit)).all())


def create_entity(db: Session, model: type[ModelT], payload: dict[str, Any]) -> ModelT:
    entity = model(**payload)
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity

