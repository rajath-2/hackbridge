-- ============================================================
-- HackBridge — SQL 01: Core Schema
-- Run this FIRST in the Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────
-- ENUM TYPES
-- ──────────────────────────────────────────────────────────
CREATE TYPE user_role        AS ENUM ('participant', 'mentor', 'judge', 'organizer');
CREATE TYPE risk_level       AS ENUM ('Clean', 'Medium', 'High');
CREATE TYPE notification_type AS ENUM ('broadcast', 'mentor_ping', 'idle_warning', 'match_suggestion');  -- v1.5: added idle_warning + match_suggestion
CREATE TYPE flag_type        AS ENUM ('plagiarism', 'track_deviation');  -- v1.5: distinguishes plagiarism vs track drift flags
CREATE TYPE match_status     AS ENUM ('pending_activity', 'track_matched', 'code_matched', 'manual_override');  -- v1.5: tracks which matching stage produced the assignment
CREATE TYPE sweep_trigger    AS ENUM ('auto_pre_round', 'auto_event_start', 'manual_organizer');  -- v1.5: records what triggered a plagiarism sweep

-- ──────────────────────────────────────────────────────────
-- EVENTS
-- ──────────────────────────────────────────────────────────
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    tracks TEXT[] DEFAULT '{}',
    judging_rounds JSONB DEFAULT '[]',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- USERS  (mirrors Supabase Auth — populated by trigger in 04)
-- ──────────────────────────────────────────────────────────
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- MENTOR PROFILES
-- ──────────────────────────────────────────────────────────
CREATE TABLE mentor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    expertise_tags TEXT[] DEFAULT '{}',
    bio TEXT,
    resume_raw TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- JUDGE PROFILES
-- ──────────────────────────────────────────────────────────
CREATE TABLE judge_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    domain TEXT,
    resume_raw TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- TEAMS
-- ──────────────────────────────────────────────────────────
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    team_code TEXT UNIQUE NOT NULL,
    leader_id UUID REFERENCES users(id),
    repo_url TEXT,
    repo_fingerprint JSONB,
    local_scan_snapshot JSONB,
    mentor_id UUID REFERENCES users(id),
    final_placement TEXT,
    -- v1.4: submission tracking
    submission_status TEXT NOT NULL DEFAULT 'unsubmitted'
        CHECK (submission_status IN ('unsubmitted', 'submitted')),
    submitted_at TIMESTAMPTZ,
    resubmission_count INTEGER NOT NULL DEFAULT 0,
    -- v1.5: track selection & smart matching
    selected_track TEXT,                                  -- set at team creation; locked once event starts
    track_locked BOOLEAN NOT NULL DEFAULT false,          -- set to true when events.start_time is reached
    match_status match_status NOT NULL DEFAULT 'pending_activity',  -- progression: pending → track_matched → code_matched
    mentor_match_score NUMERIC(5,2),                     -- Groq match percentage for currently assigned mentor
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- TEAM MEMBERS  (many-to-many: teams ↔ users)
-- ──────────────────────────────────────────────────────────
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);

-- ──────────────────────────────────────────────────────────
-- EVENT PARTICIPANTS  (many-to-many: events ↔ users)
-- ──────────────────────────────────────────────────────────
CREATE TABLE event_participants (
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
);

-- ──────────────────────────────────────────────────────────
-- SCORES
-- ──────────────────────────────────────────────────────────
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    judge_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    rubric_scores JSONB DEFAULT '{}',
    ai_suggested_scores JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (judge_id, team_id, round)
);

-- ──────────────────────────────────────────────────────────
-- FLAGS  (plagiarism)
-- ──────────────────────────────────────────────────────────
CREATE TABLE flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    -- v1.5: flag_type distinguishes plagiarism from track-drift flags
    flag_type flag_type NOT NULL DEFAULT 'plagiarism',
    risk_level risk_level DEFAULT 'Clean',
    git_evidence JSONB DEFAULT '{}',         -- plagiarism: commit timestamp analysis
    local_scan_evidence JSONB DEFAULT '{}',  -- plagiarism: ctime/mtime anomalies
    velocity_evidence JSONB DEFAULT '{}',    -- v1.5: suspicious burst analysis
    -- v1.5: track deviation fields (populated when flag_type = 'track_deviation')
    alignment_score NUMERIC(5,2),            -- Groq 0–100 score; flag raised when < 60
    alignment_rationale TEXT,               -- Groq plain-English reason for the drift
    -- v1.5: records which sweep trigger created/updated this flag
    sweep_trigger sweep_trigger,
    sweep_round INTEGER,                    -- which judging round's pre-sweep created this (NULL = event-start or manual)
    silenced BOOLEAN NOT NULL DEFAULT false, -- organizer can silence false-positive flags
    silenced_by UUID REFERENCES users(id),  -- organizer who silenced it
    silenced_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (team_id, event_id, flag_type)
);

-- ──────────────────────────────────────────────────────────
-- MATCH SUGGESTIONS  (v1.5)
-- Stores AI-proposed mentor swaps pending organizer approval.
-- Created automatically at the pre-flight re-analysis stage
-- or when an on-demand scan finds a significantly better match.
-- ──────────────────────────────────────────────────────────
CREATE TABLE match_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    current_mentor_id UUID REFERENCES users(id),
    current_match_score NUMERIC(5,2),
    suggested_mentor_id UUID REFERENCES users(id),
    suggested_match_score NUMERIC(5,2),
    ai_rationale TEXT NOT NULL,              -- Groq explanation of why this is a better match
    trigger_stage TEXT NOT NULL,             -- 'event_start' | 'pre_round_1' | 'manual' | 'on_demand'
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),  -- organizer who approved or rejected
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- COMMIT LOGS
-- ──────────────────────────────────────────────────────────
CREATE TABLE commit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    files_changed TEXT[] DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL,
    ai_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- Supports two types:
--   broadcast   : organizer → everyone in event
--   mentor_ping : participant team → assigned mentor  (v1.4: renamed from mentor_request)
-- ──────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),        -- v1.5: renamed from organizer_id to support pings/warnings
    message TEXT NOT NULL,
    type notification_type NOT NULL DEFAULT 'broadcast',
    recipient_id UUID REFERENCES users(id),     -- NULL for broadcast; mentor user_id for mentor_ping
    team_id UUID REFERENCES teams(id),          -- NULL for broadcast; team uuid for mentor_ping
    created_at TIMESTAMPTZ DEFAULT now()
);
