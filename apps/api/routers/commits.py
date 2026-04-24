from fastapi import APIRouter, Depends, HTTPException, Body
from core.supabase_client import get_supabase
from core.dependencies import get_current_user
from models.schemas import CommitPayload
from services import groq_service
from datetime import datetime

router = APIRouter(prefix="/commits", tags=["commits"])

@router.post("/")
async def ingest_commit(payload: CommitPayload):
    """CLI Commit Ingest - Auth via team_code + event_code."""
    sb = get_supabase()
    
    # Validate team and event code
    team_resp = sb.table("teams").select("id, event_id").eq("team_code", payload.team_code).single().execute()
    if not team_resp.data:
        raise HTTPException(status_code=401, detail="Invalid team code")
    
    event_resp = sb.table("events").select("id").eq("event_code", payload.event_code).single().execute()
    if not event_resp.data or event_resp.data["id"] != team_resp.data["event_id"]:
        raise HTTPException(status_code=401, detail="Invalid event code for this team")
        
    team_id = team_resp.data["id"]
    event_id = event_resp.data["id"]
    
    # 1. Summarise via Groq
    summary = await groq_service.summarise_commit(payload.message, payload.files_changed)
    
    # 2. Insert into commit_logs
    res = sb.table("commit_logs").insert({
        "team_id": team_id,
        "event_id": event_id,
        "message": payload.message,
        "files_changed": payload.files_changed,
        "timestamp": payload.timestamp.isoformat(),
        "ai_summary": summary
    }).execute()
    
    return {"status": "success", "summary": summary}

@router.get("/team/{team_id}")
async def get_team_commits(team_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("commit_logs").select("*").eq("team_id", team_id).order("timestamp", desc=True).execute()
    return res.data

@router.get("/mentor")
async def get_mentor_commits(user=Depends(get_current_user)):
    if user["role"] != "mentor":
        raise HTTPException(status_code=403, detail="Unauthorized")
    sb = get_supabase()
    # 1. Find teams
    teams_res = sb.table("teams").select("id").eq("mentor_id", user["id"]).execute()
    team_ids = [t["id"] for t in teams_res.data]
    if not team_ids:
        return []
    # 2. Find commits
    res = sb.table("commit_logs").select("*, teams(name)").in_("team_id", team_ids).order("timestamp", desc=True).limit(20).execute()
    return res.data
