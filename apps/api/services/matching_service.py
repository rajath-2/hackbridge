from core.supabase_client import get_supabase
from . import groq_service
from typing import Optional, Dict, Any

async def run_match_for_team(team_id: str, trigger_stage: str):
    sb = get_supabase()
    
    # 1. Get Team Data
    team_resp = sb.table("teams").select("*, events(id, start_time)").eq("id", team_id).single().execute()
    team = team_resp.data
    event_id = team["events"]["id"]
    
    # 2. Get All Available Mentors for this event
    participants_resp = sb.table("event_participants").select("user_id").eq("event_id", event_id).eq("role", "mentor").execute()
    participant_user_ids = [p["user_id"] for p in participants_resp.data]
    
    if not participant_user_ids:
        return
        
    mentors_resp = sb.table("mentor_profiles").select("*, users(id, name)").eq("is_available", True).in_("user_id", participant_user_ids).execute()
    mentors = mentors_resp.data
    
    if not mentors:
        return
        
    # 3. Find the best match
    best_mentor = None
    best_score = -1
    best_explanation = ""
    
    # In a production env, we might want to batch this or use a more efficient filtering before AI
    for m in mentors:
        match_result = await groq_service.score_mentor_match(
            repo_fingerprint=team.get("repo_fingerprint"),
            selected_track=team.get("selected_track"),
            expertise_tags=m.get("expertise_tags", []),
            bio=m.get("bio", "")
        )
        
        score = match_result.get("match_percentage", 0)
        if score > best_score:
            best_score = score
            best_mentor = m
            best_explanation = match_result.get("explanation", "")
            
    if not best_mentor:
        return

    # 4. Handle Assignment / Suggestion
    current_mentor_id = team.get("mentor_id")
    current_score = team.get("mentor_match_score") or 0
    
    # If no mentor assigned or it's Stage 1, auto-assign
    if not current_mentor_id or trigger_stage == 'repo_submission':
        sb.table("teams").update({
            "mentor_id": best_mentor["user_id"],
            "mentor_match_score": best_score,
            "match_status": "track_matched" if not team.get("repo_fingerprint") else "code_matched"
        }).eq("id", team_id).execute()
    else:
        # v1.5: If better match found (+20 points), create suggestion
        if best_score >= current_score + 20:
            sb.table("match_suggestions").upsert({
                "event_id": event_id,
                "team_id": team_id,
                "current_mentor_id": current_mentor_id,
                "current_match_score": current_score,
                "suggested_mentor_id": best_mentor["user_id"],
                "suggested_match_score": best_score,
                "ai_rationale": best_explanation,
                "trigger_stage": trigger_stage,
                "status": "pending"
            }, on_conflict="team_id, event_id").execute()
            
            # Send notification to organizers (Type: match_suggestion)
            # Fetch an organizer for the event to be the sender if needed, or system
            sb.table("notifications").insert({
                "event_id": event_id,
                "message": f"New mentor match suggestion for team {team['name']}",
                "type": "match_suggestion"
            }).execute()

async def run_all_matches(event_id: str, trigger_stage: str):
    sb = get_supabase()
    teams_resp = sb.table("teams").select("id").eq("event_id", event_id).execute()
    for t in teams_resp.data:
        await run_match_for_team(t["id"], trigger_stage)
