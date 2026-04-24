from fastapi import APIRouter, Depends, HTTPException, Body
from core.supabase_client import get_supabase
from core.dependencies import get_current_user
from models.schemas import CommitPayload
from services import groq_service
from datetime import datetime

router = APIRouter(prefix="/commits", tags=["commits"])

@router.post("/")
async def ingest_commit(payload: CommitPayload):
    """CLI Commit Ingest - Auth via cli_token (preferred) or team_code."""
    sb = get_supabase()
    user_id = None
    
    if payload.cli_token:
        # 1. Validate via personal token
        user_resp = sb.table("users").select("id").eq("cli_token", payload.cli_token).single().execute()
        if not user_resp.data:
            raise HTTPException(status_code=401, detail="Invalid personal CLI token")
        user_id = user_resp.data["id"]
        
        # 2. Get team and event context for this user
        team_res = sb.table("team_members").select("team_id, teams(event_id, events(event_code))").eq("user_id", user_id).execute()
        if not team_res.data:
            raise HTTPException(status_code=404, detail="User is not in a team")
        
        team_id = team_res.data[0]["team_id"]
        event_id = team_res.data[0]["teams"]["event_id"]
        event_code = team_res.data[0]["teams"]["events"]["event_code"]
        
        if payload.event_code != event_code:
            raise HTTPException(status_code=400, detail="Event code mismatch")
        
        # Mark as linked
        sb.table("users").update({"cli_linked_at": "now()"}).eq("id", user_id).execute()
    else:
        # Fallback to team_code (Legacy)
        team_resp = sb.table("teams").select("id, event_id").eq("team_code", payload.team_code).single().execute()
        if not team_resp.data:
            raise HTTPException(status_code=401, detail="Invalid team code")
        
        event_resp = sb.table("events").select("id").eq("event_code", payload.event_code).single().execute()
        if not event_resp.data or event_resp.data["id"] != team_resp.data["event_id"]:
            raise HTTPException(status_code=401, detail="Invalid event code for this team")
            
        team_id = team_resp.data["id"]
        event_id = event_resp.data["id"]
    
    # Summarise via Groq
    summary = await groq_service.summarise_commit(payload.message, payload.files_changed)
    
    # Insert into commit_logs
    sb.table("commit_logs").insert({
        "team_id": team_id,
        "user_id": user_id, # Attribution!
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
