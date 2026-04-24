from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    groq_api_key: str
    github_token: Optional[str] = ""
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    
    # Model defaults (v1.5 updated for decommissioned models)
    groq_model_heavy: str = "llama-3.3-70b-versatile"
    groq_model_fast: str = "llama-3.1-8b-instant"

    class Config:
        env_file = ".env"

settings = Settings()
