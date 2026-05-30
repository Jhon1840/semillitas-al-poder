from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("La contrasena no puede superar 72 bytes por una limitacion de bcrypt.")
        return value


class UserRead(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    phone: str | None = None
    status: str

    model_config = {"from_attributes": True}
