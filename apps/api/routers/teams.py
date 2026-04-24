from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List, Optional
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from models.schemas import TeamCreate, TeamJoin, RepoUpdate, LocalScanPayload
from services import github_service, groq_service, matching_service
from datetime import datetime, timezone

router = APIRouter(prefix="/teams", tags=["teams"])

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_team(team: TeamCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    # Logic to create team and generate team_code
    import secrets
    team_code = secrets.token_hex(4).upper()
    
    res = sb.table("teams").insert({
        "name": team.name,
        "event_id": team.event_id,
        "selected_track": team.selected_track,
        "team_code": team_code,
        "leader_id": user["id"]
    }).execute()
    
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create team")
        
    # Add leader to members
    sb.table("team_members").insert({"team_id": res.data[0]["id"], "user_id": user["id"]}).execute()
    
    return res.data[0]

@router.post("/join")
async def join_team(payload: TeamJoin, user=Depends(get_current_user)):
    sb = get_supabase()
    team_resp = sb.table("teams").select("id").eq("team_code", payload.team_code).single().execute()
    if not team_resp.data:
        raise HTTPException(status_code=404, detail="Invalid team code")
    
    team_id = team_resp.data["id"]
    res = sb.table("team_members").insert({"team_id": team_id, "user_id": user["id"]}).execute()
    return {"message": "Joined successfully", "team_id": team_id}

@router.get("/validate/{team_code}")
async def validate_team_code(team_code: str):
    """Public CLI endpoint — validates a team_code and returns IDs."""
    sb = get_supabase()
    team = sb.table("teams").select("id, event_id").eq("team_code", team_code).single().execute()
    if not team.data:
        raise HTTPException(status_code=404, detail="Invalid team code")
    return {"team_id": team.data["id"], "event_id": team.data["event_id"]}

@router.post("/{team_id}/repo")
async def update_repo(team_id: str, payload: RepoUpdate, user=Depends(get_current_user)):
    sb = get_supabase()
    # Fetch repo data
    try:
        tree = await github_service.get_file_tree(payload.repo_url)
        readme = await github_service.get_readme(payload.repo_url)
        fingerprint = await groq_service.fingerprint_repo(tree, readme)
        
        # Update team
        sb.table("teams").update({
            "repo_url": payload.repo_url,
            "repo_fingerprint": fingerprint
        }).eq("id", team_id).execute()
        
        # Trigger Stage 1 match
        await matching_service.run_match_for_team(team_id, trigger_stage="repo_submission")
        
        return {"status": "success", "fingerprint": fingerprint}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process repo: {str(e)}")

@router.post("/{team_id}/scan")
async def ingest_scan(team_id: str, payload: LocalScanPayload):
    """CLI Scan Ingest - Auth via team_code validation."""
    sb = get_supabase()
    team_resp = sb.table("teams").select("team_code").eq("id", team_id).single().execute()
    if not team_resp.data or team_resp.data["team_code"] != payload.team_code:
        raise HTTPException(status_code=401, detail="Invalid team credentials")
        
    sb.table("teams").update({
        "local_scan_snapshot": payload.model_dump()
    }).eq("id", team_id).execute()
    
    return {"status": "received"}

@router.get("/{team_id}/status")
async def get_team_status(team_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    team = sb.table("teams").select("*, mentor:mentor_id(name)").eq("id", team_id).single().execute()
    commits = sb.table("commit_logs").select("ai_summary, timestamp").eq("team_id", team_id).order("timestamp", desc=True).limit(5).execute()
    
    return {
        "team": team.data,
        "recent_commits": commits.data
    }

@router.get("/{team_id}/cli/status")
async def get_team_status_cli(team_id: str, team_code: str):
    sb = get_supabase()
    team_resp = sb.table("teams").select("team_code").eq("id", team_id).single().execute()
    if not team_resp.data or team_resp.data["team_code"] != team_code:
        raise HTTPException(status_code=401, detail="Invalid team credentials")
    
    team = sb.table("teams").select("*, mentor:mentor_id(name)").eq("id", team_id).single().execute()
    commits = sb.table("commit_logs").select("ai_summary, timestamp").eq("team_id", team_id).order("timestamp", desc=True).limit(5).execute()
    
    return {
        "team": team.data,
        "recent_commits": commits.data
    }

@router.post("/{team_id}/mentor-ping")
async def mentor_ping(team_id: str, message: str = Body(...), user=Depends(get_current_user)):
    sb = get_supabase()
    team = sb.table("teams").select("event_id, mentor_id").eq("id", team_id).single().execute()
    if not team.data["mentor_id"]:
        raise HTTPException(status_code=400, detail="No mentor assigned yet")
        
    # TODO: Implement 10-min rate limit check here
    
    sb.table("notifications").insert({
        "event_id": team.data["event_id"],
        "sender_id": user["id"],
        "recipient_id": team.data["mentor_id"],
        "team_id": team_id,
        "message": message,
        "type": "mentor_ping"
    }).execute()
    
    return {"status": "sent"}

@router.post("/{team_id}/cli/mentor-ping")
async def mentor_ping_cli(team_id: str, payload: dict = Body(...)):
    team_code = payload.get("team_code")
    message = payload.get("message")
    
    sb = get_supabase()
    team_resp = sb.table("teams").select("team_code, event_id, mentor_id").eq("id", team_id).single().execute()
    if not team_resp.data or team_resp.data["team_code"] != team_code:
        raise HTTPException(status_code=401, detail="Invalid team credentials")
        
    if not team_resp.data["mentor_id"]:
        raise HTTPException(status_code=400, detail="No mentor assigned yet")
        
    sb.table("notifications").insert({
        "event_id": team_resp.data["event_id"],
        "message": message,
        "recipient_id": team_resp.data["mentor_id"],
        "team_id": team_id,
        "type": "mentor_ping"
    }).execute()
    
    return {"status": "sent"}
