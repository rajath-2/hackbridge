from fastapi import APIRouter, Depends, HTTPException, status
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from models.schemas import EventCreate
from typing import List

router = APIRouter(prefix="/events", tags=["events"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_event(event: EventCreate, user=Depends(get_current_user)):
    if user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Only organizers can create events")
        
    sb = get_supabase()
    res = sb.table("events").insert({
        "event_code": event.event_code,
        "name": event.name,
        "start_time": event.start_time.isoformat(),
        "end_time": event.end_time.isoformat(),
        "tracks": event.tracks,
        "judging_rounds": [r.model_dump() for r in event.judging_rounds],
        "created_by": user["id"]
    }).execute()
    
    return res.data[0]

@router.get("/{event_id}")
async def get_event(event_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("events").select("*").eq("id", event_id).single().execute()
    return res.data
