-- ============================================================
-- HackBridge — SQL 07: Collaboration & Environment Tracking
-- Logic adapted from DevPulse for dependency mismatch detection
-- ============================================================

-- 1. TEAM ENVIRONMENTS
-- Stores the latest detected state of each member's local machine.
CREATE TABLE IF NOT EXISTS team_environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dependencies JSONB DEFAULT '{}',     -- { "package": "version" }
    tools JSONB DEFAULT '{}',            -- { "node": "v20.x", "python": "3.12" }
    env_keys JSONB DEFAULT '{}',         -- { "STRIPE_KEY": "present", "DB_URL": "missing" }
    last_active TIMESTAMPTZ DEFAULT now(),
    UNIQUE (team_id, user_id)
);

-- 2. TEAM OFFICIAL STATE
-- Stores the "canonical" environment requirements set by the leader/organizer.
-- If a member's environment differs from this, it's flagged as "Drift".
CREATE TABLE IF NOT EXISTS team_official_state (
    team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    dependencies JSONB DEFAULT '{}',     -- { "package": "required_version" }
    tools JSONB DEFAULT '{}',            -- { "node": ">=18.0.0" }
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TEAM ENVIRONMENT HISTORY
-- Stores a timeline of version changes (Fingerprints).
CREATE TABLE IF NOT EXISTS team_environment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,                        -- e.g., "Updated next to v15.0.0"
    changes JSONB DEFAULT '{}',          -- { "added": [], "updated": [{ "name": "next", "old": "14", "new": "15" }], "removed": [] }
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────
-- INDEXES FOR PERFORMANCE
-- ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_team_env_team ON team_environments(team_id);
CREATE INDEX IF NOT EXISTS idx_team_env_history_team ON team_environment_history(team_id);
CREATE INDEX IF NOT EXISTS idx_team_env_history_user ON team_environment_history(user_id);

-- ──────────────────────────────────────────────────────────
-- RLS POLICIES (Simplified for Hackathon usage)
-- ──────────────────────────────────────────────────────────
ALTER TABLE team_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_official_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_environment_history ENABLE ROW LEVEL SECURITY;

-- Team members can read/write their own environment
DO $$ BEGIN
    CREATE POLICY "Users can manage own environment" ON team_environments
        FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Team members can see each other's environments
DO $$ BEGIN
    CREATE POLICY "Team members can view teammate environments" ON team_environments
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_members.team_id = team_environments.team_id 
                AND team_members.user_id = auth.uid()
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Team members can view official state
DO $$ BEGIN
    CREATE POLICY "Team members can view official state" ON team_official_state
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_members.team_id = team_official_state.team_id 
                AND team_members.user_id = auth.uid()
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Leaders or organizers can update official state
DO $$ BEGIN
    CREATE POLICY "Leaders can update official state" ON team_official_state
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM teams 
                WHERE teams.id = team_official_state.team_id 
                AND teams.leader_id = auth.uid()
            ) OR (
                SELECT role FROM users WHERE id = auth.uid()
            ) = 'organizer'
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- History visibility
DO $$ BEGIN
    CREATE POLICY "Team members can view history" ON team_environment_history
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM team_members 
                WHERE team_members.team_id = team_environment_history.team_id 
                AND team_members.user_id = auth.uid()
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
