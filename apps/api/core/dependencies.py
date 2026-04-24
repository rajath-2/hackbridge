from fastapi import Header, HTTPException, status
from .supabase_client import get_supabase

async def get_current_user(authorization: str = Header(...)):
    """
    Validates the Supabase JWT passed as Bearer token.
    Returns the user's id and role from the public.users table.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth header")
    
    token = authorization.split(" ")[1]
    sb = get_supabase()
    
    try:
        # Create a fresh client just for auth to avoid polluting the global service_role client
        from supabase import create_client
        from .config import settings
        auth_client = create_client(settings.supabase_url, settings.supabase_anon_key)
        
        # Verify JWT with Supabase Auth
        user_response = auth_client.auth.get_user(token)
        if not user_response.user:
             raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
        user_id = user_response.user.id
        user_metadata = user_response.user.user_metadata
        email = user_response.user.email
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token verification failed: {str(e)}")
    
    return {
        "id": user_id,
        "role": user_metadata.get("role", "participant"),
        "name": user_metadata.get("name", "Unknown"),
        "email": email
    }
