from groq import Groq
from core.config import settings
import json
import asyncio
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger("groq_service")

_client = Groq(api_key=settings.groq_api_key)

async def _chat(system: str, user: str, heavy: bool = True) -> str:
    """
    Internal wrapper for Groq chat completions.
    Implements 3 retries with exponential backoff.
    """
    model = settings.groq_model_heavy if heavy else settings.groq_model_fast
    
    for attempt in range(3):
        try:
            # Use asyncio.to_thread as the Groq client is synchronous
            response = await asyncio.to_thread(
                _client.chat.completions.create,
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user}
                ],
                temperature=0.2,
                max_tokens=2048,
            )
            raw_content = response.choices[0].message.content.strip()
            print(f"DEBUG [Groq]: Model: {model} | Response: {raw_content[:200]}...") # Log first 200 chars
            return raw_content
        except Exception as e:
            if attempt == 2:
                raise e
            wait_time = (2 ** attempt) + 1
            await asyncio.sleep(wait_time)
    return ""

def _parse_json(raw: str) -> Dict[str, Any]:
    """Strip markdown fences and parse JSON safely."""
    try:
        clean = raw.strip()
        if clean.startswith("```"):
            lines = clean.splitlines()
            # Remove ```json and ```
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            clean = "\n".join(lines)
        return json.loads(clean)
    except Exception as e:
        print(f"JSON Parsing Error: {str(e)}\nRaw Content: {raw}")
        return {}

async def fingerprint_repo(file_tree: str, readme: str) -> Dict[str, Any]:
    system = (
        "You are a senior developer. Analyse the provided GitHub file tree and README. "
        "Return ONLY a JSON object with: "
        '{ "languages": [], "frameworks": [], "domain": string, "complexity": "low"|"medium"|"high", "summary": string }'
    )
    user = f"FILE_TREE: {file_tree}\nREADME: {readme}"
    print(f"DEBUG [Groq]: Analyzing repo with {len(file_tree)} bytes of file tree data.")
    raw = await _chat(system, user)
    print(f"DEBUG [Groq]: Fingerprint Response: {raw}")
    return _parse_json(raw)

async def summarise_commit(message: str, files_changed: List[str]) -> str:
    system = "You are a concise technical writer. Summarise the following git commit in exactly one sentence."
    user = f"Commit message: {message}\nFiles changed: {', '.join(files_changed)}"
    return await _chat(system, user, heavy=False)

async def score_mentor_match(repo_fingerprint: Optional[Dict], selected_track: Optional[str], expertise_tags: List[str], bio: str) -> Dict[str, Any]:
    """
    v1.5: Stage 1 (track-based) if fingerprint is None; Stage 2 (code-based) otherwise.
    """
    if not repo_fingerprint:
        # Stage 1: Track-based
        system = (
            "You are a hackathon coordinator. The team has not pushed code yet but has selected a track. "
            "Match them with a mentor based on the track and the mentor's expertise. "
            "Return ONLY JSON: { \"match_percentage\": number, \"explanation\": string }"
        )
        user = (
            f"Team selected track: {selected_track}\n"
            f"Mentor expertise: {expertise_tags}\n"
            f"Mentor bio: {bio}"
        )
    else:
        # Stage 2: Code-based
        system = (
            "You are a hackathon coordinator. Match the team's codebase fingerprint with the mentor's expertise. "
            "Return ONLY JSON: { \"match_percentage\": number, \"explanation\": string }"
        )
        user = (
            f"Team repo fingerprint: {json.dumps(repo_fingerprint)}\n"
            f"Mentor expertise: {expertise_tags}\n"
            f"Mentor bio: {bio}"
        )
        
    raw = await _chat(system, user)
    return _parse_json(raw)

async def suggest_scores(criteria: List[str], repo_fingerprint: Dict, velocity: float) -> Dict[str, Any]:
    system = (
        "You are a hackathon judge assistant. Return ONLY JSON: "
        '{ "rubric_scores": { "<criterion>": number }, "rationale": string }'
    )
    user = (
        f"Rubric criteria: {criteria}\n"
        f"Repo fingerprint: {json.dumps(repo_fingerprint)}\n"
        f"Commit velocity (commits/hour): {velocity}"
    )
    raw = await _chat(system, user)
    return _parse_json(raw)

async def check_track_alignment(repo_fingerprint: Dict, selected_track: str) -> Dict[str, Any]:
    """v1.5: NEW track drift check."""
    system = (
        f"You are a technical auditor. Compare the team's codebase fingerprint against their chosen track: '{selected_track}'. "
        "Does the code align with the track? (e.g. if track is 'AI/ML' and they are building a simple landing page, that's a drift). "
        "Return ONLY JSON: { \"alignment_score\": number (0-100), \"rationale\": string }"
    )
    user = f"Repo fingerprint: {json.dumps(repo_fingerprint)}"
    raw = await _chat(system, user)
    return _parse_json(raw)

async def analyse_resume(resume_text: str) -> Dict[str, Any]:
    system = (
        "You are an expert at analysing professional resumes. "
        "Return ONLY a JSON object with: "
        '{ "expertise_tags": string[], "domain": string, "bio": string } '
        "expertise_tags: up to 10 concise tech/domain tags. "
        "bio: 2-3 sentence professional bio suitable for a hackathon mentor/judge profile."
    )
    user = f"Resume text: {resume_text}"
    raw = await _chat(system, user)
    return _parse_json(raw)

async def audit_code_originality(file_name: str, code_content: str, selected_track: str) -> Dict[str, Any]:
    """v1.5: Tier 5 AI Originality Audit."""
    system = (
        "You are an expert technical auditor and plagiarism detective. "
        f"The user is participating in a hackathon on the track: '{selected_track}'. "
        "Analyze the provided code snippet. Determine if it appears to be: "
        "1. Original work created during a hackathon. "
        "2. Common boilerplate or 'Hello World' code for the framework. "
        "3. Code from a well-known public tutorial, GitHub repository, or Stack Overflow answer. "
        "Return ONLY JSON: { "
        "\"originality_score\": number (0-100, where 100 is highly original), "
        "\"is_common_boilerplate\": boolean, "
        "\"detected_source\": string (optional, name of tutorial/repo if suspected), "
        "\"rationale\": string "
        "}"
    )
    # Truncate code if too long to fit in context
    user = f"FILE: {file_name}\nCONTENT:\n{code_content[:6000]}"
    raw = await _chat(system, user)
    return _parse_json(raw)

async def verify_suggestion_implementation(suggestion: str, diff_history: List[Dict]) -> Dict[str, Any]:
    """v1.5: Verify if a judge's suggestion was implemented based on git diffs."""
    system = (
        "You are a technical judge's assistant. You are given a suggestion provided by a judge to a hackathon team, "
        "and a series of git diffs (patches) representing the team's subsequent changes. "
        "Determine if the team has implemented the suggested idea. "
        "Be thorough but fair. If the implementation is partial, mention it. "
        "Return ONLY JSON: { \"implemented\": boolean, \"confidence\": number (0-100), \"rationale\": string }"
    )
    
    diff_context = ""
    for commit in diff_history:
        diff_context += f"\nCOMMIT: {commit['message']}\n"
        for file in commit.get("files", []):
            diff_context += f"FILE: {file['filename']}\nPATCH:\n{file['patch']}\n"
    
    # Truncate if too long (Groq has limits, let's keep it under ~15k chars for safety in this pass)
    if len(diff_context) > 15000:
        diff_context = diff_context[:15000] + "\n... [TRUNCATED]"
        
    user = f"JUDGE SUGGESTION: {suggestion}\n\nCOMMIT HISTORY & DIFFS:\n{diff_context}"
    raw = await _chat(system, user)
    return _parse_json(raw)

async def verify_task_implementation(task_desc: str, diff_history: List[Dict], dependency_changes: Dict) -> Dict[str, Any]:
    """v1.5: Verify if a team member implemented an assigned task."""
    system = (
        "You are a team lead's AI assistant. Verify if a team member has implemented the assigned task. "
        "You are given a task description, git diffs of their subsequent commits, and any dependency changes. "
        "Analyze if: "
        "1. The task requirements are met. "
        "2. The code quality is acceptable. "
        "3. Any new dependencies added are justified and necessary for the task. "
        "Return ONLY JSON: { \"implemented\": boolean, \"quality_score\": number (0-100), \"dependency_review\": string, \"rationale\": string }"
    )
    
    diff_context = ""
    for commit in diff_history:
        diff_context += f"\nCOMMIT: {commit['message']}\n"
        for file in commit.get("files", []):
            diff_context += f"FILE: {file['filename']}\nPATCH:\n{file['patch']}\n"
            
    if len(diff_context) > 15000:
        logger.warning(f"Diff context too large ({len(diff_context)} chars). Truncating to 15k.")
        diff_context = diff_context[:15000] + "\n... [TRUNCATED]"
    else:
        logger.info(f"Analyzing task implementation with {len(diff_context)} chars of diff context.")
        
    user = (
        f"TASK DESCRIPTION: {task_desc}\n\n"
        f"DEPENDENCY CHANGES: {json.dumps(dependency_changes)}\n\n"
        f"CODE CHANGES (DIFFS):\n{diff_context}"
    )
    
    raw = await _chat(system, user)
    logger.debug(f"Raw Groq Response: {raw}")
    return _parse_json(raw)
