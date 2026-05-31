from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NEXO API"
    app_env: str = "local"
    debug: bool = Field(default=True, validation_alias="APP_DEBUG")
    api_prefix: str = "/api/v1"

    database_url: str = Field(
        default="postgresql+psycopg://nexo:nexo@db:5432/nexo",
        validation_alias="DATABASE_URL",
    )
    redis_url: str = "redis://redis:6379/0"

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 1440
    algorithm: str = "HS256"

    seeddss_api_url: str | None = None
    seeddss_api_key: str | None = None
    seeddss_images_field: str = "images"
    seeddss_login_path: str = "/api/login"
    open_meteo_api_url: str = "https://api.open-meteo.com/v1/forecast"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_api_url: str = "https://generativelanguage.googleapis.com/v1beta"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
