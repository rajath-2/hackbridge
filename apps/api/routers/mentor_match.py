from fastapi import APIRouter, Depends, HTTPException, Body
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from services import matching_service
from models.schemas import MatchSuggestionUpdate

router = APIRouter(prefix="/mentor-match", tags=["matching"])

@router.post("/event/{event_id}/run-all")
async def trigger_all_matching(event_id: str, trigger_stage: str = "manual", user=Depends(get_current_user)):
    if user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    sb = get_supabase()
    event_resp = sb.table("events").select("created_by").eq("id", event_id).single().execute()
    if not event_resp.data or event_resp.data["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    await matching_service.run_all_matches(event_id, trigger_stage)
    return {"status": "batch matching initiated"}

@router.post("/suggestions/{suggestion_id}")
async def review_suggestion(suggestion_id: str, payload: MatchSuggestionUpdate, user=Depends(get_current_user)):
    if user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    sb = get_supabase()
    # 1. Fetch suggestion and check event ownership
    sugg_resp = sb.table("match_suggestions").select("*, events(created_by)").eq("id", suggestion_id).single().execute()
    sugg = sugg_resp.data
    
    if not sugg or sugg["events"]["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if payload.status == "approved":
        # Apply the match
        sb.table("teams").update({
            "mentor_id": sugg["suggested_mentor_id"],
            "mentor_match_score": sugg["suggested_match_score"],
            "match_status": "code_matched"
        }).eq("id", sugg["team_id"]).execute()
        
    # Update suggestion status
    sb.table("match_suggestions").update({
        "status": payload.status,
        "reviewed_by": user["id"],
        "reviewed_at": "now()"
    }).eq("id", suggestion_id).execute()
    
    return {"status": payload.status}

@router.get("/suggestions/event/{event_id}")
async def get_suggestions(event_id: str, user=Depends(get_current_user)):
    if user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    sb = get_supabase()
    event_resp = sb.table("events").select("created_by").eq("id", event_id).single().execute()
    if not event_resp.data or event_resp.data["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
        
    res = sb.table("match_suggestions").select("*, teams(name), current_mentor:current_mentor_id(name), suggested_mentor:suggested_mentor_id(name)").eq("event_id", event_id).eq("status", "pending").execute()
    return res.data
