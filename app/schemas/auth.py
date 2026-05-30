from uuid import UUID

from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None


class UserRead(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    phone: str | None = None
    status: str

    model_config = {"from_attributes": True}

