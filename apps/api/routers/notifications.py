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
    # Check ownership
    event_resp = sb.table("events").select("created_by").eq("id", payload.event_id).single().execute()
    if not event_resp.data or event_resp.data["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
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
    
    # Basic access check
    if user["role"] == "organizer":
        event_resp = sb.table("events").select("created_by").eq("id", event_id).single().execute()
        if not event_resp.data or event_resp.data["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        # Check if participant/judge/mentor is in the event
        part_resp = sb.table("event_participants").select("*").eq("event_id", event_id).eq("user_id", user["id"]).execute()
        if not part_resp.data:
            # Maybe they are in a team?
            team_resp = sb.table("team_members").select("teams(event_id)").eq("user_id", user["id"]).execute()
            if not any(t["teams"]["event_id"] == event_id for t in team_resp.data):
                raise HTTPException(status_code=403, detail="Access denied")

    query = sb.table("notifications").select("*").eq("event_id", event_id).order("created_at", desc=True)
    
    if user["role"] == "mentor":
        query = query.or_(f"type.eq.broadcast,recipient_id.eq.{user['id']}")
    elif user["role"] == "participant":
        query = query.or_(f"type.eq.broadcast,recipient_id.eq.{user['id']}")
        
    res = query.execute()
    return res.data