from pydantic_settings import BaseSettings, SettingsConfigDict
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./clinic.db"
    llm_api_key: str | None = None
    frontend_origin: str = "http://localhost:5173"
    demo_today: str = "2026-11-21"
    api_prefix: str = "/api/v1"
    upi_id: str = "clinic@upi"
    google_client_id: str = ""
settings = Settings()
