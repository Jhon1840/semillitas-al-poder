from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from httpx import HTTPStatusError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.integrations.seeddss_client import login_to_external_service
from app.models.entities import User
from app.schemas.auth import Token, UserCreate, UserRead

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
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


async def _login_with_seeddss(email: str, password: str) -> dict:
    if not email or not password:
        raise HTTPException(status_code=422, detail="Email y password son requeridos.")

    try:
        return await login_to_external_service(email, password)
    except HTTPStatusError as exc:
        detail = "Credenciales invalidas en SeedDSS."
        if exc.response is not None:
            try:
                payload = exc.response.json()
                detail = payload.get("error") or payload.get("message") or detail
            except ValueError:
                detail = exc.response.text or detail
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"No se pudo iniciar sesion en SeedDSS: {exc}") from exc


@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)) -> dict | Token:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
        email = str(payload.get("email") or payload.get("username") or "").strip()
        password = str(payload.get("password") or "")
        return await _login_with_seeddss(email, password)

    form = await request.form()
    username = str(form.get("username") or form.get("email") or "").strip()
    password = str(form.get("password") or "")
    user = db.scalar(select(User).where(User.email == username))
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Credenciales invalidas")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return Token(access_token=create_access_token(str(user.id)))


@router.post("/seeddss-login")
async def seeddss_login(payload: dict) -> dict:
    email = str(payload.get("email") or "").strip()
    password = str(payload.get("password") or "")
    return await _login_with_seeddss(email, password)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
