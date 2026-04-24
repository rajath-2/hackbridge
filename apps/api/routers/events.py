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

@router.get("/all")
async def get_all_events(user=Depends(get_current_user)):
    sb = get_supabase()
    query = sb.table("events").select("*")
    
    # If the user is an organizer, they should only see events they created.
    # Participants/mentors/judges might need to see all events to join them.
    if user["role"] == "organizer":
        query = query.eq("created_by", user["id"])
        
    res = query.execute()
    return res.data

@router.get("/{event_id}")
async def get_event(event_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("events").select("*").eq("id", event_id).single().execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # If the user is an organizer, they should only be able to access events they created.
    if user["role"] == "organizer" and res.data["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="You do not have access to this event")
        
    return res.data
