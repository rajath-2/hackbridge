from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import List, Optional
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from models.schemas import TeamCreate, TeamJoin, RepoUpdate, LocalScanPayload, GroqRelayPayload, DebugPingPayload
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
    res = sb.table("teams").select("id, event_id").eq("team_code", team_code).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Invalid team code")
    return {"team_id": res.data[0]["id"], "event_id": res.data[0]["event_id"]}

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
    """CLI Scan Ingest - Auth via cli_token (preferred) or team_code."""
    sb = get_supabase()
    
    if payload.cli_token:
        # Validate via personal token
        user_resp = sb.table("users").select("id").eq("cli_token", payload.cli_token).single().execute()
        if not user_resp.data:
            raise HTTPException(status_code=401, detail="Invalid personal CLI token")
        # Check if user is in the team
        membership = sb.table("team_members").select("team_id").eq("team_id", team_id).eq("user_id", user_resp.data["id"]).execute()
        if not membership.data:
             raise HTTPException(status_code=403, detail="User not authorized for this team")
        
        # Mark as linked
        sb.table("users").update({"cli_linked_at": "now()"}).eq("id", user_resp.data["id"]).execute()
    else:
        # Fallback to team_code validation
        team_resp = sb.table("teams").select("team_code").eq("id", team_id).single().execute()
        if not team_resp.data or team_resp.data["team_code"] != payload.team_code:
            raise HTTPException(status_code=401, detail="Invalid team credentials")
        
    sb.table("teams").update({
        "local_scan_snapshot": payload.model_dump(mode='json')
    }).eq("id", team_id).execute()
    
    return {"status": "received"}

@router.get("/event/{event_id}")
async def get_teams_by_event(event_id: str, user=Depends(get_current_user)):
    """Get all teams for an event. Organizers can only see their own events."""
    sb = get_supabase()
    
    # Check access for organizers
    if user["role"] == "organizer":
        event_resp = sb.table("events").select("created_by").eq("id", event_id).single().execute()
        if not event_resp.data or event_resp.data["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    res = sb.table("teams").select("*").eq("event_id", event_id).execute()
    return res.data

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
    res = sb.table("teams").select("team_code").eq("id", team_id).execute()
    if not res.data or res.data[0]["team_code"] != team_code:
        raise HTTPException(status_code=401, detail="Invalid team credentials")
    
    team_data = sb.table("teams").select("*, mentor:mentor_id(name)").eq("id", team_id).execute()
    if not team_data.data:
        raise HTTPException(status_code=404, detail="Team not found")
        
    commits = sb.table("commit_logs").select("ai_summary, timestamp").eq("team_id", team_id).order("timestamp", desc=True).limit(5).execute()
    
    return {
        "team": team_data.data[0],
        "recent_commits": commits.data
    }

@router.post("/{team_id}/mentor-ping")
async def mentor_ping(team_id: str, payload: dict = Body(...), user=Depends(get_current_user)):
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
        "message": payload.get("message", "Ping!"),
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

@router.get("/mentor/assigned")
async def get_mentor_assigned_teams(user=Depends(get_current_user)):
    """Get all teams assigned to the current mentor."""
    if user["role"] != "mentor":
        raise HTTPException(status_code=403, detail="Only mentors can access this endpoint")
    sb = get_supabase()
    res = sb.table("teams").select("*").eq("mentor_id", user["id"]).execute()
    return res.data

@router.get("/me")
async def get_my_team(user=Depends(get_current_user)):
    sb = get_supabase()
    # Find team where user is a member or leader, including members and event info
    res = sb.table("team_members").select("team_id, teams(*, events(event_code), team_members(*, users(name, email)))").eq("user_id", user["id"]).execute()
    if not res.data:
         # Check if they are a leader (though they should be in team_members too)
         res = sb.table("teams").select("*, events(event_code), team_members(*, users(name, email))").eq("leader_id", user["id"]).execute()
         if not res.data:
             return None
         return res.data[0]
         
    return res.data[0]["teams"]

@router.get("/mentor/assigned")
async def get_mentor_teams(user=Depends(get_current_user)):
    if user["role"] != "mentor":
        raise HTTPException(status_code=403, detail="Unauthorized")
    sb = get_supabase()
    res = sb.table("teams").select("*").eq("mentor_id", user["id"]).execute()
    return res.data

@router.get("/event/{event_id}")
async def get_teams_by_event(event_id: str, user=Depends(get_current_user)):
    if user["role"] not in ["organizer", "judge"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    sb = get_supabase()
    
    # Check if the organizer owns this event
    if user["role"] == "organizer":
        event_resp = sb.table("events").select("created_by").eq("id", event_id).single().execute()
        if not event_resp.data or event_resp.data["created_by"] != user["id"]:
            raise HTTPException(status_code=403, detail="You do not have access to this event's teams")
            
    res = sb.table("teams").select("*, team_members(users(name, email))").eq("event_id", event_id).execute()
    return res.data
@router.post("/{team_id}/cli/groq-relay")
async def groq_relay_cli(team_id: str, payload: GroqRelayPayload):
    """Proxies CLI Groq requests through backend — keeps GROQ_API_KEY server-side."""
    sb = get_supabase()
    
    # 1. Validate cli_token
    user_resp = sb.table("users").select("id").eq("cli_token", payload.cli_token).single().execute()
    if not user_resp.data:
        raise HTTPException(status_code=401, detail="Invalid CLI token")
    
    # 2. Validate team_code matches team_id
    team_resp = sb.table("teams").select("team_code").eq("id", team_id).single().execute()
    if not team_resp.data or team_resp.data["team_code"] != payload.team_code:
        raise HTTPException(status_code=401, detail="Invalid team credentials")
    
    # 3. Call Groq
    try:
        content = await groq_service._chat(
            system_prompt=payload.system_prompt,
            user_prompt=payload.user_prompt,
            heavy=payload.heavy
        )
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq relay failed: {str(e)}")

@router.post("/{team_id}/cli/debug-ping")
async def debug_ping_cli(team_id: str, payload: DebugPingPayload):
    """Sends full debug report to assigned mentor as a notification."""
    sb = get_supabase()
    
    # 1. Validate credentials
    user_resp = sb.table("users").select("id").eq("cli_token", payload.cli_token).single().execute()
    if not user_resp.data:
        raise HTTPException(status_code=401, detail="Invalid CLI token")
        
    team_resp = sb.table("teams").select("team_code, event_id, mentor_id").eq("id", team_id).single().execute()
    if not team_resp.data or team_resp.data["team_code"] != payload.team_code:
        raise HTTPException(status_code=401, detail="Invalid team credentials")
        
    if not team_resp.data["mentor_id"]:
        raise HTTPException(status_code=400, detail="No mentor assigned yet")
        
    # 2. Format rich message
    message = (
        f"🚨 DEBUG REPORT FROM {payload.team_code}\n"
        f"Stack: {payload.stack_identity}\n\n"
        f"--- AI ANALYSIS ---\n{payload.debug_output}\n\n"
        f"--- STACK TRACE ---\n{payload.stack_trace[:500]}..."
    )
    
    # 3. Insert notification
    sb.table("notifications").insert({
        "event_id": team_resp.data["event_id"],
        "message": message,
        "recipient_id": team_resp.data["mentor_id"],
        "team_id": team_id,
        "type": "mentor_ping",
        "metadata": payload.model_dump(mode='json')
    }).execute()
    
    return {"status": "sent"}
