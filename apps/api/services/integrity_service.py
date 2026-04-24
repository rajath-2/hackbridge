from core.supabase_client import get_supabase
from . import groq_service, plagiarism_service
import asyncio
from datetime import datetime, timezone
from typing import Optional

async def check_track_drift(team_id: str, event_id: str, sweep_trigger: str):
    sb = get_supabase()
    
    # Get team track and fingerprint
    team_resp = sb.table("teams").select("selected_track, repo_fingerprint").eq("id", team_id).single().execute()
    track = team_resp.data.get("selected_track")
    fingerprint = team_resp.data.get("repo_fingerprint")
    
    if not track or not fingerprint:
        return
        
    result = await groq_service.check_track_alignment(fingerprint, track)
    score = result.get("alignment_score", 100)
    
    if score < 60:
        sb.table("flags").upsert({
            "team_id": team_id,
            "event_id": event_id,
            "flag_type": "track_deviation",
            "alignment_score": score,
            "alignment_rationale": result.get("rationale", "No rationale provided"),
            "sweep_trigger": sweep_trigger,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="team_id, event_id, flag_type").execute()
    else:
        # Resolve existing drift flag if score improved
        sb.table("flags").delete().match({
            "team_id": team_id,
            "event_id": event_id,
            "flag_type": "track_deviation"
        }).execute()

async def run_sweep(event_id: str, trigger: str, round: Optional[int] = None):
    sb = get_supabase()
    
    # 1. Fetch all teams
    teams_resp = sb.table("teams").select("id").eq("event_id", event_id).execute()
    teams = teams_resp.data
    
    # 2. Run plagiarism and drift checks in parallel
    tasks = []
    for t in teams:
        tasks.append(plagiarism_service.analyse(t["id"], event_id, trigger, round))
        tasks.append(check_track_drift(t["id"], event_id, trigger))
        
    await asyncio.gather(*tasks)
    
    # 3. Side effects by trigger
    if trigger == 'auto_event_start':
        sb.table("teams").update({"track_locked": True}).eq("event_id", event_id).execute()
        
    # 4. Identify idle teams (0 commits during event window)
    # TODO: Implement idle warning logic based on commit count in event window
    
    return {"teams_checked": len(teams), "status": "completed"}
