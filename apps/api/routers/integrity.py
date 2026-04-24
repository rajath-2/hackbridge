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
        
    result = await integrity_service.run_sweep(event_id, trigger, round)
    return result

@router.get("/flags/event/{event_id}")
async def get_flags(event_id: str, user=Depends(get_current_user)):
    """Get all flags for an event."""
    from core.supabase_client import get_supabase
    sb = get_supabase()
    
    query = sb.table("flags").select("*, teams(name)").eq("event_id", event_id)
    
    if user["role"] == "judge":
        query = query.eq("flag_type", "plagiarism")
    elif user["role"] == "participant":
        # Participants should filter by their team, handled better by RLS but safe here too
        raise HTTPException(status_code=403, detail="Direct flag access not allowed for participants")
        
    res = query.execute()
    return res.data
