from fastapi import APIRouter, Depends, HTTPException, Query
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from models.schemas import ScoreSubmit
from services import groq_service

router = APIRouter(prefix="/scores", tags=["scores"])

@router.post("/")
async def submit_score(score: ScoreSubmit, user=Depends(get_current_user)):
    if user["role"] not in ["judge", "organizer"]:
        raise HTTPException(status_code=403, detail="Unauthorized role")
    
    sb = get_supabase()
    # Check access
    if user["role"] == "organizer":
        event_resp = sb.table("events").select("created_by").eq("id", score.event_id).single().execute()
        if not event_resp.data or event_resp.data["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        # Judge check
        part_resp = sb.table("event_participants").select("*").eq("event_id", score.event_id).eq("user_id", user["id"]).execute()
        if not part_resp.data:
            raise HTTPException(status_code=403, detail="Access denied")

    res = sb.table("scores").upsert({
        "judge_id": user["id"],
        "team_id": score.team_id,
        "event_id": score.event_id,
        "round": score.round,
        "rubric_scores": score.rubric_scores,
        "notes": score.notes
    }, on_conflict="judge_id, team_id, round").execute()
    
    return res.data[0]

@router.post("/ai-suggest/{team_id}")
async def get_ai_suggested_score(team_id: str, round: int = Query(...), user=Depends(get_current_user)):
    sb = get_supabase()
    # Fetch team data and event criteria
    team = sb.table("teams").select("*, events(*)").eq("id", team_id).single().execute()
    if not team.data:
        raise HTTPException(status_code=404, detail="Team not found")
        
    event_id = team.data["event_id"]
    # Check access
    if user["role"] == "organizer":
        if team.data["events"]["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user["role"] == "judge":
         part_resp = sb.table("event_participants").select("*").eq("event_id", event_id).eq("user_id", user["id"]).execute()
         if not part_resp.data:
             raise HTTPException(status_code=403, detail="Access denied")

    rounds = team.data["events"]["judging_rounds"]
    current_round = next((r for r in rounds if r["round"] == round), None)
    
    if not current_round:
        raise HTTPException(status_code=404, detail="Judging round not found")
        
    suggestion = await groq_service.suggest_scores(
        criteria=current_round["criteria"],
        repo_fingerprint=team.data.get("repo_fingerprint", {}),
        velocity=0 # Placeholder
    )
    
    return suggestion
