from core.supabase_client import get_supabase
from . import github_service
from datetime import datetime, timezone
import json
from typing import Optional, Dict, Any

async def analyse(team_id: str, event_id: str, sweep_trigger: str, sweep_round: Optional[int] = None):
    sb = get_supabase()
    
    # 1. Get Event Start Time
    event_resp = sb.table("events").select("start_time").eq("id", event_id).single().execute()
    start_time_str = event_resp.data["start_time"]
    start_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
    
    # 2. Get Team Repo and Scan Data
    team_resp = sb.table("teams").select("repo_url, local_scan_snapshot").eq("id", team_id).single().execute()
    repo_url = team_resp.data.get("repo_url")
    local_scan = team_resp.data.get("local_scan_snapshot")
    
    if not repo_url:
        return # Skip teams without repos
        
    # 3. Git signal analysis
    try:
        commits = await github_service.get_commits(repo_url)
        total_commits = len(commits)
        pre_event_commits = [c for c in commits if datetime.fromisoformat(c["timestamp"].replace("Z", "+00:00")) < start_time]
        pre_event_ratio = len(pre_event_commits) / total_commits if total_commits > 0 else 0
        
        git_signal = "Clean"
        if pre_event_ratio > 0.5: git_signal = "High"
        elif pre_event_ratio > 0.2: git_signal = "Medium"
        
        git_evidence = {
            "total_commits": total_commits,
            "pre_event_commits": len(pre_event_commits),
            "ratio": round(pre_event_ratio, 2)
        }
    except Exception as e:
        print(f"Git analysis failed for {team_id}: {str(e)}")
        git_signal = "Clean"
        git_evidence = {"error": str(e)}

    # 4. Local Scan signal analysis
    local_signal = "Clean"
    local_evidence = {}
    if local_scan:
        pre_files = len(local_scan.get("pre_event_files", []))
        total_files = local_scan.get("file_count", 0)
        pre_ratio = pre_files / total_files if total_files > 0 else 0
        
        if pre_ratio > 0.4: local_signal = "High"
        elif pre_ratio > 0.15: local_signal = "Medium"
        
        local_evidence = {
            "total_files": total_files,
            "pre_event_files": pre_files,
            "ratio": round(pre_ratio, 2)
        }

    # 5. Velocity Anomaly Signal (v1.5)
    velocity_signal = "Clean"
    velocity_evidence = {"suspicious_bursts": []}
    # Logic: 3+ hour idle periods followed by 500+ lines changed
    # (In a real implementation, we'd iterate commit pairs and call get_commit_diff)
    # For now, we record the intent and a placeholder for the logic
    # TODO: Implement full diff-based velocity check
    
    # 6. Final Risk Level
    risk_map = {"Clean": 0, "Medium": 1, "High": 2}
    inv_risk_map = {0: "Clean", 1: "Medium", 2: "High"}
    max_risk_val = max(risk_map[git_signal], risk_map[local_signal], risk_map[velocity_signal])
    final_risk = inv_risk_map[max_risk_val]
    
    # 7. Upsert Flag
    sb.table("flags").upsert({
        "team_id": team_id,
        "event_id": event_id,
        "flag_type": "plagiarism",
        "risk_level": final_risk,
        "git_evidence": git_evidence,
        "local_scan_evidence": local_evidence,
        "velocity_evidence": velocity_evidence,
        "sweep_trigger": sweep_trigger,
        "sweep_round": sweep_round,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }, on_conflict="team_id, event_id, flag_type").execute()

    return final_risk
