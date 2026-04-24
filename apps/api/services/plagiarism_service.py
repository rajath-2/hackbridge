from core.supabase_client import get_supabase
from . import github_service, cross_check_service, groq_service
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

    # 5. Final Risk Level
    risk_map = {"Clean": 0, "Medium": 1, "High": 2}
    inv_risk_map = {0: "Clean", 1: "Medium", 2: "High"}
    max_risk_val = max(risk_map[git_signal], risk_map[local_signal])
    final_risk = inv_risk_map[max_risk_val]
    
    # 7. Upsert Flag
    sb.table("flags").upsert({
        "team_id": team_id,
        "event_id": event_id,
        "flag_type": "plagiarism",
        "risk_level": final_risk,
        "git_evidence": git_evidence,
        "local_scan_evidence": local_evidence,
        "sweep_trigger": sweep_trigger,
        "sweep_round": sweep_round,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }, on_conflict="team_id, event_id, flag_type").execute()

    return final_risk

async def run_event_cross_check(event_id: str, trigger: str = "manual_sweep"):
    """
    Triggers a full event scan using CopyDetect and flags teams with high similarity.
    """
    sb = get_supabase()
    
    # 1. Run the scan
    scan_results = await cross_check_service.run_cross_project_scan(event_id)
    
    if scan_results["status"] != "completed":
        return scan_results

    # 2. Process matches
    flags_created = 0
    for match in scan_results["results"]:
        similarity = match["similarity"]
        team_ids = match["team_ids"]
        team_names = match["teams"]
        
        # We create a flag for each team involved in the match
        for i, team_id in enumerate(team_ids):
            other_team = team_names[1-i]
            
            # Generate an AI rationale for the match
            # This "feeds the AI" the similarity data
            rationale = f"High similarity ({int(similarity*100)}%) detected between '{team_names[0]}' and '{team_names[1]}'. "
            rationale += f"Similarities found in core files: {', '.join(match['representative_files'])}."
            
            # Upsert flag
            sb.table("flags").upsert({
                "team_id": team_id,
                "event_id": event_id,
                "flag_type": "cross_project_similarity",
                "risk_level": "High" if similarity > 0.6 else "Medium",
                "alignment_score": int((1 - similarity) * 100),
                "alignment_rationale": rationale,
                "git_evidence": {"other_team": other_team, "similarity": similarity, "files": match["representative_files"]},
                "sweep_trigger": trigger,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }, on_conflict="team_id, event_id, flag_type").execute()
            
            flags_created += 1
            
        
    return {
        "status": "completed",
        "matches_processed": len(scan_results["results"]),
        "flags_updated": flags_created
    }

async def run_global_originality_audit(team_id: str, event_id: str, trigger: str = "manual_sweep"):
    """
    Tier 5: AI-based Global Originality Audit.
    Fetches core files and asks Groq if they are original or from tutorials.
    """
    from .cross_check_service import MAIN_FILE_PATTERNS
    sb = get_supabase()
    
    # 1. Get team details
    team_resp = sb.table("teams").select("repo_url, selected_track").eq("id", team_id).single().execute()
    repo_url = team_resp.data.get("repo_url")
    track = team_resp.data.get("selected_track")
    
    if not repo_url:
        return {"status": "skipped", "reason": "No repo URL"}

    # 2. Find core files using GitHub tree
    tree_str = await github_service.get_file_tree(repo_url)
    files = tree_str.split("\n")
    
    core_files = [f for f in files if any(f.endswith(p) for p in MAIN_FILE_PATTERNS)]
    # Filter for actually being a "main" file (not in some random deep subdir if possible)
    core_files = sorted(core_files, key=lambda x: x.count("/"))[:3] # Audit top 3 core files
    
    if not core_files:
        return {"status": "skipped", "reason": "No core files found to audit"}

    # 3. Audit each file
    audit_results = []
    for file_path in core_files:
        content = await github_service.get_file_content(repo_url, file_path)
        if not content: continue
        
        audit = await groq_service.audit_code_originality(file_path, content, track or "General")
        audit_results.append({
            "file": file_path,
            "score": audit.get("originality_score", 100),
            "source": audit.get("detected_source"),
            "is_boilerplate": audit.get("is_common_boilerplate"),
            "rationale": audit.get("rationale")
        })

    if not audit_results:
        return {"status": "skipped", "reason": "Failed to fetch file contents"}

    # 4. Aggregate results
    avg_score = sum(a["score"] for a in audit_results) / len(audit_results)
    any_low = any(a["score"] < 50 for a in audit_results)
    
    # 5. Create flag if risk detected
    if avg_score < 70 or any_low:
        worst_audit = min(audit_results, key=lambda x: x["score"])
        sb.table("flags").upsert({
            "team_id": team_id,
            "event_id": event_id,
            "flag_type": "plagiarism", # Reuse plagiarism flag or add new type
            "risk_level": "High" if avg_score < 40 else "Medium",
            "velocity_evidence": {"ai_originality_audit": audit_results}, # Store in velocity_evidence or extend schema
            "alignment_rationale": f"AI Originality Audit Score: {int(avg_score)}/100. " + worst_audit["rationale"],
            "sweep_trigger": trigger,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="team_id, event_id, flag_type").execute()

    return {
        "status": "completed",
        "average_originality_score": avg_score,
        "audits": audit_results
    }
