from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict
import logging
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from models.schemas import EnvironmentSyncPayload, OfficialStateUpdate, TaskCreate, TaskVerify
from datetime import datetime

router = APIRouter(prefix="/collaboration", tags=["collaboration"])
logger = logging.getLogger("collaboration")

@router.post("/sync")
async def sync_environment(payload: EnvironmentSyncPayload):
    """
    Syncs a developer's local environment state.
    Logic:
    1. Validate user via cli_token.
    2. Update team_environments.
    3. Compare with previous state; if changed, record in team_environment_history.
    """
    sb = get_supabase()
    
    # 1. Validate user
    user_resp = sb.table("users").select("id, name").eq("cli_token", payload.cli_token).single().execute()
    if not user_resp.data:
        raise HTTPException(status_code=401, detail="Invalid CLI token")
    user_id = user_resp.data["id"]
    
    # 2. Validate team
    team_resp = sb.table("teams").select("team_code").eq("id", payload.team_id).single().execute()
    if not team_resp.data or team_resp.data["team_code"] != payload.team_code:
        raise HTTPException(status_code=401, detail="Invalid team credentials")

    # 3. Fetch previous state for history
    prev_env_resp = sb.table("team_environments").select("*").eq("team_id", payload.team_id).eq("user_id", user_id).maybe_single().execute()
    prev_env = prev_env_resp.data if prev_env_resp else None
    
    changes = {"added": [], "updated": [], "removed": []}
    has_changes = False
    
    if prev_env:
        old_deps = prev_env.get("dependencies", {})
        new_deps = payload.dependencies
        
        # Find changes
        for name, new_ver in new_deps.items():
            if name not in old_deps:
                changes["added"].append(name)
                has_changes = True
            elif old_deps[name] != new_ver:
                changes["updated"].append({"name": name, "old": old_deps[name], "new": new_ver})
                has_changes = True
        
        for name in old_deps:
            if name not in new_deps:
                changes["removed"].append(name)
                has_changes = True
    else:
        has_changes = True # First sync
        changes["added"] = list(payload.dependencies.keys())

    # 4. Update environment
    sb.table("team_environments").upsert({
        "team_id": payload.team_id,
        "user_id": user_id,
        "dependencies": payload.dependencies,
        "tools": payload.tools,
        "env_keys": payload.env_keys,
        "last_active": datetime.now().isoformat()
    }, on_conflict="team_id,user_id").execute()

    # 5. Record history if changed
    if has_changes:
        msg = payload.message or (f"Initial environment sync" if not prev_env else f"Environment update by {user_resp.data['name']}")
        sb.table("team_environment_history").insert({
            "team_id": payload.team_id,
            "user_id": user_id,
            "message": msg,
            "changes": changes
        }).execute()

    return {"status": "success", "has_changes": has_changes}

@router.get("/team/{team_id}")
async def get_team_collaboration(team_id: str, user=Depends(get_current_user)):
    """
    Returns all member environments, history, and official state.
    """
    sb = get_supabase()
    
    # 1. Check membership
    membership = sb.table("team_members").select("*").eq("team_id", team_id).eq("user_id", user["id"]).execute()
    if not membership.data and user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 2. Fetch data
    envs = sb.table("team_environments").select("*, users(name)").eq("team_id", team_id).execute()
    history = sb.table("team_environment_history").select("*, users(name)").eq("team_id", team_id).order("created_at", desc=True).limit(20).execute()
    official = sb.table("team_official_state").select("*").eq("team_id", team_id).maybe_single().execute()
    
    return {
        "environments": envs.data if envs else [],
        "history": history.data if history else [],
        "official_state": official.data if official else None
    }

@router.post("/official")
async def set_official_state(payload: OfficialStateUpdate, user=Depends(get_current_user)):
    """
    Freezes the canonical environment for the team.
    Only leaders or organizers.
    """
    sb = get_supabase()
    
    # 1. Check permissions
    is_leader = False
    team_resp = sb.table("teams").select("leader_id").eq("id", payload.team_id).single().execute()
    if team_resp.data and team_resp.data["leader_id"] == user["id"]:
        is_leader = True
        
    if not is_leader and user["role"] != "organizer":
        raise HTTPException(status_code=403, detail="Only team leaders or organizers can set official state")
        
    # 2. Upsert official state
    sb.table("team_official_state").upsert({
        "team_id": payload.team_id,
        "dependencies": payload.dependencies,
        "tools": payload.tools,
        "updated_by": user["id"],
        "updated_at": "now()"
    }, on_conflict="team_id").execute()
    
    return {"status": "success"}

# --- Task Management ---

@router.post("/tasks", status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, user=Depends(get_current_user)):
    sb = get_supabase()
    
    # 1. Verify leader
    team = sb.table("teams").select("leader_id").eq("id", payload.team_id).single().execute()
    if not team.data or team.data["leader_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only team leaders can assign tasks")
        
    # 2. Create task
    res = sb.table("tasks").insert({
        "team_id": payload.team_id,
        "assigned_to": payload.assigned_to,
        "created_by": user["id"],
        "title": payload.title,
        "description": payload.description,
        "status": "pending"
    }).execute()
    
    return res.data[0]

@router.get("/tasks/{team_id}")
async def get_team_tasks(team_id: str, user=Depends(get_current_user)):
    sb = get_supabase()
    # Check membership
    membership = sb.table("team_members").select("*").eq("team_id", team_id).eq("user_id", user["id"]).execute()
    if not membership.data:
        raise HTTPException(status_code=403, detail="Access denied")
        
    res = sb.table("tasks").select("*, assigned_user:assigned_to(name), creator:created_by(name)").eq("team_id", team_id).order("created_at", desc=True).execute()
    return res.data

@router.post("/tasks/verify")
async def verify_task(payload: TaskVerify, user=Depends(get_current_user)):
    from services import github_service, groq_service
    sb = get_supabase()
    
    logger.info(f"Initiating AI verification for Task ID: {payload.task_id} (requested by {user['id']})")
    
    # 1. Fetch task and team info
    task = sb.table("tasks").select("*, teams(*)").eq("id", payload.task_id).single().execute()
    if not task.data:
        logger.error(f"Task {payload.task_id} not found")
        raise HTTPException(status_code=404, detail="Task not found")
        
    team_id = task.data["team_id"]
    repo_url = task.data["teams"]["repo_url"]
    assigned_at = task.data["assigned_at"]
    
    # 2. Check permission (leader only)
    if task.data["teams"]["leader_id"] != user["id"]:
         logger.warning(f"Unauthorized verification attempt for task {payload.task_id} by user {user['id']}")
         raise HTTPException(status_code=403, detail="Only team leaders can verify tasks")
         
    if not repo_url:
        logger.error(f"Repo URL missing for team {team_id}")
        raise HTTPException(status_code=400, detail="Team hasn't submitted a repository yet")
        
    logger.info(f"Fetching local commit logs since {assigned_at}")
    local_commits = sb.table("commit_logs").select("*").eq("team_id", team_id).gte("timestamp", assigned_at).execute()
    
    logger.info(f"Local commits found in DB: {len(local_commits.data)}")
    diff_history = []
    
    if local_commits.data and any(c.get("patch") for c in local_commits.data):
        logger.info(f"Found {len(local_commits.data)} local commits with patches")
        for c in local_commits.data:
            if c.get("patch"):
                diff_history.append({
                    "sha": "local",
                    "message": c["message"],
                    "files": [{"filename": f, "patch": c["patch"]} for f in c["files_changed"]]
                })
    else:
        logger.info("No local patches found or missing. Falling back to GitHub API.")
        # Normalize timestamp for GitHub API (requires YYYY-MM-DDTHH:MM:SSZ)
        since_ts = assigned_at
        if "+" in since_ts:
            since_ts = since_ts.split("+")[0]
        if "." in since_ts:
            since_ts = since_ts.split(".")[0]
        since_ts += "Z"
        
        logger.info(f"Fetching commits from GitHub since {since_ts}")
        gh_commits = await github_service.get_commits(repo_url, since=since_ts)
        logger.info(f"Found {len(gh_commits)} GitHub commits")
        
        for c in gh_commits:
            diff_data = await github_service.get_commit_diff(repo_url, c["sha"])
            diff_history.append({
                "sha": c["sha"],
                "message": c["message"],
                "files": diff_data["files"]
            })
        
    if not diff_history:
        logger.info("No code changes detected in local logs or GitHub; skipping AI analysis")
        return {"implemented": False, "rationale": "No code changes detected since task assignment."}
        
    # 4. Detect dependency changes
    logger.info("Aggregating dependency changes from environment history...")
    history = sb.table("team_environment_history").select("changes").eq("team_id", team_id).gte("created_at", assigned_at).execute()
    
    aggregated_changes = {"added": [], "updated": [], "removed": []}
    for entry in history.data:
        changes = entry.get("changes", {})
        aggregated_changes["added"].extend(changes.get("added", []))
        aggregated_changes["updated"].extend(changes.get("updated", []))
        aggregated_changes["removed"].extend(changes.get("removed", []))
        
    logger.info(f"Dependencies: {len(aggregated_changes['added'])} added, {len(aggregated_changes['updated'])} updated")
        
    # 5. AI Verification
    logger.info(f"Calling Groq for verification analysis...")
    result = await groq_service.verify_task_implementation(
        task_desc=f"{task.data['title']}: {task.data['description']}",
        diff_history=diff_history,
        dependency_changes=aggregated_changes
    )
    
    logger.info(f"AI Result: Implemented={result.get('implemented')}, Score={result.get('quality_score')}")
    
    # 6. Update task status
    sb.table("tasks").update({
        "status": "verified" if result.get("implemented") else "pending",
        "verified_at": "now()",
        "ai_verification_rationale": result.get("rationale")
    }).eq("id", payload.task_id).execute()
    
    return result
