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

class CommitPayload(BaseModel):
    team_code: str
    event_code: str
    message: str
    files_changed: List[str]
    timestamp: datetime

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
    notes: Optional[str] = None
