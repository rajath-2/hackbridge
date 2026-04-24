from fastapi import APIRouter, Depends, HTTPException, status
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from models.schemas import EventCreate
from typing import List, Optional

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
@router.get("/cli/{event_id}/requirements")
async def get_event_requirements_cli(event_id: str, cli_token: str):
    """CLI endpoint — validates cli_token and returns track requirements."""
    sb = get_supabase()
    
    # 1. Validate token
    user_res = sb.table("users").select("id").eq("cli_token", cli_token).single().execute()
    if not user_res.data:
        raise HTTPException(status_code=401, detail="Invalid CLI token")
        
    # 2. Return event requirements
    event_res = sb.table("events").select("tracks, judging_rounds, name").eq("id", event_id).single().execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Event not found")
        
    return event_res.data
@router.get("/{event_id}/participants")
async def get_event_participants(event_id: str, role: Optional[str] = None, user=Depends(get_current_user)):
    sb = get_supabase()
    
    # 1. Check access: Organizers can only see their own event participants
    if user["role"] == "organizer":
        event_res = sb.table("events").select("created_by").eq("id", event_id).single().execute()
        if not event_res.data or event_res.data["created_by"] != user["id"]:
             raise HTTPException(status_code=403, detail="Access denied")

    # 2. Build query
    # We join with users, and then sub-join with mentor_profiles and judge_profiles
    query = sb.table("event_participants") \
        .select("*, users(name, mentor_profiles(expertise_tags, bio), judge_profiles(domain, title))") \
        .eq("event_id", event_id)
    
    if role:
        query = query.eq("role", role)
        
    res = query.execute()
    return res.data
