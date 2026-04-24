from supabase import create_client, Client
from typing import Optional
from .config import settings

_client: Optional[Client] = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client
