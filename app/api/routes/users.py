from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.entities import User
from app.schemas.auth import UserCreate, UserRead
from app.services.crud import get_or_404, list_entities

router = APIRouter()


@router.get("", response_model=list[UserRead])
def list_users(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)) -> list[User]:
    return list_entities(db, User, limit, offset)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="El email ya esta registrado")
    user = User(
        name=payload.name,
        email=str(payload.email),
        password_hash=get_password_hash(payload.password),
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: UUID, db: Session = Depends(get_db)) -> User:
    return get_or_404(db, User, user_id)

