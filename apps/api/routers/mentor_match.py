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
    await matching_service.run_all_matches(event_id, trigger_stage)
    return {"status": "batch matching initiated"}

@router.post("/suggestions/{suggestion_id}")
async def review_suggestion(suggestion_id: str, payload: MatchSuggestionUpdate, user=Depends(get_current_user)):
    if user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    sb = get_supabase()
    # 1. Fetch suggestion
    sugg_resp = sb.table("match_suggestions").select("*").eq("id", suggestion_id).single().execute()
    sugg = sugg_resp.data
    
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
