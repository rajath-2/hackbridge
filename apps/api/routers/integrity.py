from fastapi import APIRouter, Depends, HTTPException
from core.dependencies import get_current_user
from services import integrity_service
from typing import Optional

router = APIRouter(prefix="/integrity", tags=["integrity"])

@router.post("/sweep/event/{event_id}")
async def run_integrity_sweep(event_id: str, trigger: str = "manual_organizer", round: Optional[int] = None, user=Depends(get_current_user)):
    """Run plagiarism and track drift checks for all teams."""
    if user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Only organizers can trigger sweeps")
    
    from core.supabase_client import get_supabase
    sb = get_supabase()
    event_resp = sb.table("events").select("created_by").eq("id", event_id).single().execute()
    if not event_resp.data or event_resp.data["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    result = await integrity_service.run_sweep(event_id, trigger, round)
    return result

@router.get("/flags/event/{event_id}")
async def get_flags(event_id: str, user=Depends(get_current_user)):
    """Get all flags for an event."""
    from core.supabase_client import get_supabase
    sb = get_supabase()
    
    # Check access
    if user["role"] == "organizer":
        event_resp = sb.table("events").select("created_by").eq("id", event_id).single().execute()
        if not event_resp.data or event_resp.data["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user["role"] == "judge":
        # Check if judge is participant of the event
        part_resp = sb.table("event_participants").select("*").eq("event_id", event_id).eq("user_id", user["id"]).execute()
        if not part_resp.data:
            raise HTTPException(status_code=403, detail="You are not a judge for this event")
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = sb.table("flags").select("*, teams(name)").eq("event_id", event_id)
    
    if user["role"] == "judge":
        query = query.eq("flag_type", "plagiarism")
        
    res = query.execute()
    return res.data
