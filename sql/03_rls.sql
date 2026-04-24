-- ============================================================
-- HackBridge — SQL 03: Row Level Security (RLS)
-- Run AFTER 02_indexes.sql
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Enable RLS on all tables
-- ──────────────────────────────────────────────────────────
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE commit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_suggestions  ENABLE ROW LEVEL SECURITY;  -- v1.5

-- ──────────────────────────────────────────────────────────
-- Helper function: get role of the calling user
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS user_role AS $$
    SELECT role FROM users WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ──────────────────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────────────────
-- Any authenticated user can read any user row (needed for mentor/judge lookups)
CREATE POLICY "users_read_all"
    ON users FOR SELECT
    USING (auth.role() = 'authenticated');

-- Users can only insert their own row (enforced by trigger, but policy is defence-in-depth)
CREATE POLICY "users_insert_own"
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can only update their own row
CREATE POLICY "users_update_own"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- ──────────────────────────────────────────────────────────
-- EVENTS
-- ──────────────────────────────────────────────────────────
CREATE POLICY "events_read_all"
    ON events FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "events_insert_organizer"
    ON events FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'organizer');

CREATE POLICY "events_update_organizer"
    ON events FOR UPDATE
    USING (created_by = auth.uid());

-- ──────────────────────────────────────────────────────────
-- MENTOR PROFILES
-- ──────────────────────────────────────────────────────────
CREATE POLICY "mentor_profiles_read_all"
    ON mentor_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "mentor_profiles_insert_own"
    ON mentor_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "mentor_profiles_update_own"
    ON mentor_profiles FOR UPDATE
    USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- JUDGE PROFILES
-- ──────────────────────────────────────────────────────────
CREATE POLICY "judge_profiles_read_all"
    ON judge_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "judge_profiles_insert_own"
    ON judge_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "judge_profiles_update_own"
    ON judge_profiles FOR UPDATE
    USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- TEAMS
-- ──────────────────────────────────────────────────────────
CREATE POLICY "teams_read_all"
    ON teams FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "teams_insert_participant"
    ON teams FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'participant');

-- Only team leader can update their team (repo, etc.)
-- Backend service role bypasses RLS for mentor_id and fingerprint updates
CREATE POLICY "teams_update_leader"
    ON teams FOR UPDATE
    USING (leader_id = auth.uid());

-- v1.4: Any team member can trigger a submission update (submit endpoint)
-- Backend enforces event.end_time check and increments resubmission_count via service role
CREATE POLICY "teams_submit_member"
    ON teams FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = teams.id
              AND tm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        -- Only the submission-related columns are writable by members
        -- Actual column-level enforcement is done in FastAPI, not RLS
        get_user_role(auth.uid()) = 'participant'
    );

-- ──────────────────────────────────────────────────────────
-- TEAM MEMBERS
-- ──────────────────────────────────────────────────────────
CREATE POLICY "team_members_read_all"
    ON team_members FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "team_members_insert_own"
    ON team_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- EVENT PARTICIPANTS
-- ──────────────────────────────────────────────────────────
CREATE POLICY "event_participants_read_all"
    ON event_participants FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "event_participants_insert_own"
    ON event_participants FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- SCORES
-- ──────────────────────────────────────────────────────────
-- Only judges and organizers can read scores
CREATE POLICY "scores_read"
    ON scores FOR SELECT
    USING (get_user_role(auth.uid()) IN ('judge', 'organizer'));

-- Judges can only insert scores attributed to themselves
CREATE POLICY "scores_insert_judge"
    ON scores FOR INSERT
    WITH CHECK (
        get_user_role(auth.uid()) = 'judge'
        AND judge_id = auth.uid()
    );

-- Judges can update their own scores
CREATE POLICY "scores_update_judge"
    ON scores FOR UPDATE
    USING (
        get_user_role(auth.uid()) = 'judge'
        AND judge_id = auth.uid()
    );

-- ──────────────────────────────────────────────────────────
-- FLAGS
-- ──────────────────────────────────────────────────────────
-- Organizers see all flags (plagiarism + track_deviation)
CREATE POLICY "flags_read_organizer"
    ON flags FOR SELECT
    USING (get_user_role(auth.uid()) = 'organizer');

-- Judges can read plagiarism risk badges for the teams they are scoring.
-- They do NOT see track_deviation flags (those are an organizer-only integrity concern).
CREATE POLICY "flags_read_judge"
    ON flags FOR SELECT
    USING (
        get_user_role(auth.uid()) = 'judge'
        AND flag_type = 'plagiarism'
    );

-- Participants can read their own team's plagiarism flag only.
-- Track-deviation flags are hidden from participants (organizer discretion).
CREATE POLICY "flags_read_own_team"
    ON flags FOR SELECT
    USING (
        flag_type = 'plagiarism'
        AND EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = flags.team_id
              AND tm.user_id = auth.uid()
        )
    );

-- Backend service role handles all flag writes and silencing — no client INSERT/UPDATE policy needed.

-- ──────────────────────────────────────────────────────────
-- MATCH SUGGESTIONS  (v1.5)
-- ──────────────────────────────────────────────────────────
-- Only organizers can view pending/resolved match suggestions
CREATE POLICY "match_suggestions_read_organizer"
    ON match_suggestions FOR SELECT
    USING (get_user_role(auth.uid()) = 'organizer');

-- Only organizers can approve or reject a suggestion (UPDATE status, reviewed_by, reviewed_at)
CREATE POLICY "match_suggestions_update_organizer"
    ON match_suggestions FOR UPDATE
    USING (get_user_role(auth.uid()) = 'organizer');

-- All match_suggestion inserts are performed by the backend service role — no client INSERT policy needed.

-- ──────────────────────────────────────────────────────────
-- COMMIT LOGS
-- ──────────────────────────────────────────────────────────
-- Mentors and organizers can read all commit logs within their event
-- Participants can read their own team's logs
CREATE POLICY "commit_logs_read"
    ON commit_logs FOR SELECT
    USING (
        get_user_role(auth.uid()) IN ('organizer', 'mentor')
        OR
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = commit_logs.team_id
              AND tm.user_id = auth.uid()
        )
    );

-- Backend service role handles inserts (from CLI via FastAPI)

-- ──────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ──────────────────────────────────────────────────────────
-- Broadcast: any event participant can read
-- mentor_ping: only the recipient (mentor) or organizers  (v1.4: renamed from mentor_request)
CREATE POLICY "notifications_read"
    ON notifications FOR SELECT
    USING (
        (
            type = 'broadcast'
            AND (
                -- User is explicitly registered as an event participant
                EXISTS (
                    SELECT 1 FROM event_participants ep
                    WHERE ep.event_id = notifications.event_id
                      AND ep.user_id = auth.uid()
                )
                OR
                -- User is participating via a team in this event
                EXISTS (
                    SELECT 1
                    FROM team_members tm
                    JOIN teams t ON t.id = tm.team_id
                    WHERE t.event_id = notifications.event_id
                      AND tm.user_id = auth.uid()
                )
                OR
                -- Organizer who created the event can read broadcasts too
                EXISTS (
                    SELECT 1 FROM events e
                    WHERE e.id = notifications.event_id
                      AND e.created_by = auth.uid()
                      AND get_user_role(auth.uid()) = 'organizer'
                )
            )
        )
        OR
        (
            type = 'mentor_ping'
            AND (
                recipient_id = auth.uid()
                OR get_user_role(auth.uid()) = 'organizer'
            )
        )
        OR
        (
            -- Targeted notifications are readable by recipient (and organizers)
            type IN ('idle_warning', 'match_suggestion')
            AND (
                recipient_id = auth.uid()
                OR get_user_role(auth.uid()) = 'organizer'
            )
        )
    );

-- Organizers can insert broadcast notifications directly from the client
CREATE POLICY "notifications_insert_broadcast"
    ON notifications FOR INSERT
    WITH CHECK (
        type = 'broadcast'
        AND get_user_role(auth.uid()) = 'organizer'
    );

-- mentor_ping inserts are handled by backend service role (which bypasses RLS)
-- No client INSERT policy for mentor_ping — intentional  (v1.4: renamed from mentor_request)
-- idle_warning and match_suggestion notification inserts are also handled by the backend service role.
-- No client INSERT policy for those types — intentional  (v1.5)
