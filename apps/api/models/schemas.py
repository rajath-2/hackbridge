from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- Events ---
class RubricCriterion(BaseModel):
    name: str
    description: Optional[str] = None
    weight: float = 1.0

class JudgingRound(BaseModel):
    round: int
    start: Optional[str] = None
    end: Optional[str] = None
    criteria: List[RubricCriterion]

class EventCreate(BaseModel):
    event_code: str
    name: str
    start_time: datetime
    end_time: datetime
    tracks: List[str] = []
    judging_rounds: List[JudgingRound] = []

# --- Teams ---
class TeamCreate(BaseModel):
    name: str
    event_id: str
    selected_track: str

class TeamJoin(BaseModel):
    team_code: str

class RepoUpdate(BaseModel):
    repo_url: str

# --- CLI Ingest ---
class LocalScanPayload(BaseModel):
    file_count: int
    directory_depth: int
    language_breakdown: Dict[str, int]
    pre_event_files: List[str]
    scan_timestamp: datetime
    team_code: str
    cli_token: Optional[str] = None

class CommitPayload(BaseModel):
    team_code: str
    event_code: str
    message: str
    files_changed: List[str]
    timestamp: datetime
    cli_token: Optional[str] = None

# --- Matching & Integrity ---
class MatchSuggestionUpdate(BaseModel):
    status: str # 'approved' | 'rejected'

# --- Notifications ---
class BroadcastCreate(BaseModel):
    event_id: str
    message: str

class MentorPingCreate(BaseModel):
    event_id: str
    message: str

# --- Scores ---
class ScoreSubmit(BaseModel):
    team_id: str
    event_id: str
    round: int
    rubric_scores: Dict[str, float]
# --- CLI Relay & Debug ---
class GroqRelayPayload(BaseModel):
    cli_token: str
    team_code: str
    prompt_type: str          # 'debug' | 'fix' | 'fix_retry' | 'bisect' | 'api_key_blueprint'
    system_prompt: str        # full system message
    user_prompt: str          # full user message  
    heavy: bool = False       # True -> llama-3.3-70b, False -> llama-3.1-8b

class DebugPingPayload(BaseModel):
    cli_token: str
    team_code: str
    stack_trace: str          # cleaned, no source code
    stack_identity: str       # "Next.js 14 on Node 20"
    debug_output: str         # the 3-section AI analysis
    git_diff_summary: str     # diff of errored files only
    timestamp: datetime

# --- Collaboration & Environment ---
class EnvironmentSyncPayload(BaseModel):
    team_id: str
    team_code: str
    cli_token: str
    dependencies: Dict[str, str]
    tools: Dict[str, str]
    env_keys: Dict[str, str]
    message: Optional[str] = None # Optional "sync" message for history

class OfficialStateUpdate(BaseModel):
    team_id: str
    dependencies: Dict[str, str]
    tools: Dict[str, str]
