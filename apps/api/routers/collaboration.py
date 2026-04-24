from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict
from core.dependencies import get_current_user
from core.supabase_client import get_supabase
from models.schemas import EnvironmentSyncPayload, OfficialStateUpdate
from datetime import datetime

router = APIRouter(prefix="/collaboration", tags=["collaboration"])

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
    }).execute()

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
    }).execute()
    
    return {"status": "success"}
