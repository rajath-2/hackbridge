from fastapi import APIRouter, Depends, HTTPException
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from models.schemas import BroadcastCreate

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.post("/broadcast")
async def send_broadcast(payload: BroadcastCreate, user=Depends(get_current_user)):
    if user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Only organizers can broadcast")
        
    sb = get_supabase()
    res = sb.table("notifications").insert({
        "event_id": payload.event_id,
        "sender_id": user["id"],
        "message": payload.message,
        "type": "broadcast"
    }).execute()
    
    return res.data[0]

@router.get("/event/{event_id}")
async def get_notifications(event_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    # Filter by user role/id is handled better by RLS, but we mirror it here
    query = sb.table("notifications").select("*").eq("event_id", event_id).order("created_at", desc=True)
    
    if user["role"] == "mentor":
        query = query.or_(f"type.eq.broadcast,recipient_id.eq.{user['id']}")
    elif user["role"] == "participant":
        # Check team pings or broadcasts
        query = query.or_(f"type.eq.broadcast,recipient_id.eq.{user['id']}")
        
    res = query.execute()
    return res.data