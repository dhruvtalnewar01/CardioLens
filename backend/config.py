"""
CHD Predictor — Pydantic Settings
Single source of truth for all configuration. Every module imports from here.
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

# Resolve the .env file relative to THIS file's parent directory (chd-predictor/)
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=('settings_',)
    )

    # ── OpenRouter LLM ────────────────────────────────────────────────────
    openrouter_api_key: str
    openrouter_primary_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    openrouter_advanced_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    openrouter_temperature: float = 0.1

    # ── Database ──────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://chd_user:chd_pass@localhost:5432/chd_predictor"
    postgres_user: str = "chd_user"
    postgres_password: str = "chd_pass"
    postgres_db: str = "chd_predictor"

    # ── Redis ─────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_celery_broker: str = "redis://localhost:6379/1"
    redis_cache_db: str = "redis://localhost:6379/2"

    # ── Vector Store ──────────────────────────────────────────────────────
    chroma_persist_dir: str = "./chroma_db"
    chroma_collection_guidelines: str = "aha_acc_guidelines"
    chroma_collection_pubmed: str = "pubmed_cardiology"
    chroma_collection_drugs: str = "drug_database"

    # ── ML ────────────────────────────────────────────────────────────────
    mlflow_tracking_uri: str = "http://localhost:5000"
    model_weights_dir: str = "./model_weights"
    enable_gpu: bool = False

    # ── Security ──────────────────────────────────────────────────────────
    secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ── App ───────────────────────────────────────────────────────────────
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "*"
    api_v1_prefix: str = "/api/v1"
    max_file_size_mb: int = 50

    # ── Optional integrations ─────────────────────────────────────────────
    ncbi_api_key: str = ""
    alert_webhook_url: str = ""
    fhir_base_url: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_bucket_name: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
