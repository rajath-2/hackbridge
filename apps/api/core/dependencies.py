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
        # Verify JWT with Supabase Auth
        user_response = sb.auth.get_user(token)
        if not user_response.user:
             raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = user_response.user.id
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token verification failed: {str(e)}")
    
    # Fetch user data from public.users table
    user_row = sb.table("users").select("id, role, name, email").eq("id", user_id).single().execute()
    if not user_row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    
    return user_row.data
