from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    checkout_secret_key: str
    checkout_webhook_secret: str
    checkout_processing_channel_id: str | None = None
    checkout_api_base_url: str = "https://api.sandbox.checkout.com"
    frontend_base_url: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
