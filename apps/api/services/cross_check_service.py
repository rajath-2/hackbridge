import os
import shutil
from copydetect import CopyDetector
from typing import List, Dict, Any
from core.supabase_client import get_supabase
from . import github_service

MAIN_FILE_PATTERNS = [
    "page.tsx", "page.jsx", "layout.tsx", "App.tsx", "App.jsx", "App.js",
    "main.py", "app.py", "server.py", "index.js", "index.ts", "server.js", "server.ts",
    "main.go", "main.cpp", "main.c", "index.html"
]

async def run_cross_project_scan(event_id: str):
    """
    1. Fetch all teams for the event.
    2. Download their repos.
    3. Extract "main" files to a temporary scan directory.
    4. Run copydetect.
    5. Generate JSON results and HTML report.
    """
    sb = get_supabase()
    teams_resp = sb.table("teams").select("id, name, repo_url").eq("event_id", event_id).execute()
    teams = [t for t in teams_resp.data if t.get("repo_url")]
    
    if len(teams) < 2:
        return {"status": "skipped", "reason": "Not enough teams with repos"}

    base_temp_dir = f"temp/event_{event_id}_scan"
    scan_input_dir = os.path.join(base_temp_dir, "input")
    report_output_dir = os.path.join(base_temp_dir, "report")
    
    # Cleanup
    if os.path.exists(base_temp_dir):
        shutil.rmtree(base_temp_dir)
    os.makedirs(scan_input_dir, exist_ok=True)
    os.makedirs(report_output_dir, exist_ok=True)

    team_map = {} # path -> team_name

    for team in teams:
        team_id = team["id"]
        team_repo_dir = os.path.join(base_temp_dir, "repos", team_id)
        
        try:
            await github_service.download_repo_archive(team["repo_url"], team_repo_dir)
            
            # Extract "main" files to scan_input_dir/{team_name}
            team_scan_dir = os.path.join(scan_input_dir, team["name"])
            os.makedirs(team_scan_dir, exist_ok=True)
            
            found_main = False
            for root, _, files in os.walk(team_repo_dir):
                for file in files:
                    if file in MAIN_FILE_PATTERNS:
                        src = os.path.join(root, file)
                        # Avoid name collisions if multiple "main" files exist in subdirs
                        rel_path = os.path.relpath(src, team_repo_dir).replace(os.sep, "_")
                        dest = os.path.join(team_scan_dir, rel_path)
                        shutil.copy2(src, dest)
                        found_main = True
            
            if not found_main:
                # If no "main" files found, copy top-level source files as fallback
                for file in os.listdir(team_repo_dir):
                    if os.path.isfile(os.path.join(team_repo_dir, file)) and file.endswith(('.py', '.js', '.ts', '.tsx', '.go')):
                        shutil.copy2(os.path.join(team_repo_dir, file), os.path.join(team_scan_dir, file))
            
            team_map[team["name"]] = team_id
            
        except Exception as e:
            print(f"Failed to process team {team['name']}: {str(e)}")

    # Run CopyDetect
    detector = CopyDetector(
        test_dirs=[scan_input_dir],
        extensions=["py", "js", "ts", "tsx", "go", "cpp", "c", "html"],
        display_t=0.3,
        silent=True
    )
    detector.run()
    
    # Generate HTML report
    detector.generate_html_report(report_output_dir)
    
    # Extract results as JSON for AI
    # similarity_matrix is a 3D array: [file1_idx][file2_idx][2] (2 values: score1, score2)
    # We want a simpler team-to-team summary
    results = []
    
    # detector.file_data maps file paths to indices
    # We can aggregate by directory (team name)
    
    summary = {} # (team1, team2) -> max_similarity
    
    for match in detector.get_matches():
        # match is a Match object with file1, file2, score1, score2
        team1 = os.path.basename(os.path.dirname(match.file1))
        team2 = os.path.basename(os.path.dirname(match.file2))
        
        if team1 == team2: continue
        
        pair = tuple(sorted([team1, team2]))
        max_score = max(match.score1, match.score2)
        
        if pair not in summary or max_score > summary[pair]["score"]:
            summary[pair] = {
                "score": max_score,
                "file1": os.path.basename(match.file1),
                "file2": os.path.basename(match.file2),
                "team1_id": team_map.get(team1),
                "team2_id": team_map.get(team2)
            }

    for (t1, t2), data in summary.items():
        if data["score"] > 0.3:
            results.append({
                "teams": [t1, t2],
                "team_ids": [data["team1_id"], data["team2_id"]],
                "similarity": round(data["score"], 2),
                "representative_files": [data["file1"], data["file2"]]
            })

    # TODO: Upload report_output_dir to Supabase Storage
    # For now, return the JSON results
    
    return {
        "status": "completed",
        "matches_found": len(results),
        "results": results,
        "report_path": report_output_dir
    }
