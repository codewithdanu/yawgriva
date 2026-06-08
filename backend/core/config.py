"""
Application configuration via environment variables.
Uses pydantic-settings for type-safe config with validation.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://yawgriva:yawgriva_secret@db:5432/yawgriva"

    # Redis
    REDIS_URL: str = "redis://cache:6379/0"

    # JWT
    JWT_SECRET: str = "change-this-to-a-random-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    # AI / LLM
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = ""

    # MinIO / S3 Storage
    MINIO_ENDPOINT: str = "http://minio:9000"
    MINIO_EXTERNAL_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadminpassword"
    MINIO_BUCKET: str = "checkpoint-photos"

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }


settings = Settings()
