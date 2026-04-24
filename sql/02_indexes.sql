-- ============================================================
-- HackBridge — SQL 02: Indexes
-- Run AFTER 01_schema.sql
-- ============================================================

-- Teams
CREATE INDEX idx_teams_event_id           ON teams(event_id);
CREATE INDEX idx_teams_mentor_id          ON teams(mentor_id);
CREATE INDEX idx_teams_team_code          ON teams(team_code);
CREATE INDEX idx_teams_leader_id          ON teams(leader_id);
CREATE INDEX idx_teams_submission_status  ON teams(submission_status);  -- v1.4: organizer dashboard + checklist queries
CREATE INDEX idx_teams_selected_track     ON teams(event_id, selected_track);  -- v1.5: filter teams by track within an event
CREATE INDEX idx_teams_match_status       ON teams(event_id, match_status);    -- v1.5: organizer matching dashboard queries

-- Commit logs
CREATE INDEX idx_commit_logs_team_id  ON commit_logs(team_id);
CREATE INDEX idx_commit_logs_event_id ON commit_logs(event_id);
CREATE INDEX idx_commit_logs_ts       ON commit_logs(timestamp DESC);
CREATE INDEX idx_commit_logs_user_id  ON commit_logs(user_id);  -- v1.4: per-member breakdown in /stats endpoint

-- Scores
CREATE INDEX idx_scores_team_event ON scores(team_id, event_id);
CREATE INDEX idx_scores_judge_id   ON scores(judge_id);

-- Flags
CREATE INDEX idx_flags_team_id    ON flags(team_id);
CREATE INDEX idx_flags_event_id   ON flags(event_id);
CREATE INDEX idx_flags_risk_level ON flags(risk_level);
CREATE INDEX idx_flags_flag_type  ON flags(event_id, flag_type);  -- v1.5: separate plagiarism vs track_deviation views
CREATE INDEX idx_flags_silenced   ON flags(event_id, silenced);   -- v1.5: filter unsilenced flags for organizer dashboard

-- Match Suggestions (v1.5)
CREATE INDEX idx_match_suggestions_event_id   ON match_suggestions(event_id);
CREATE INDEX idx_match_suggestions_team_id    ON match_suggestions(team_id);
CREATE INDEX idx_match_suggestions_status     ON match_suggestions(event_id, status);  -- pending suggestion queries
CREATE INDEX idx_match_suggestions_created_at ON match_suggestions(created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_event_id    ON notifications(event_id);
CREATE INDEX idx_notifications_recipient   ON notifications(recipient_id);
CREATE INDEX idx_notifications_type        ON notifications(type);
CREATE INDEX idx_notifications_team_id     ON notifications(team_id);
CREATE INDEX idx_notifications_created_at  ON notifications(created_at DESC);

-- Participants & members
CREATE INDEX idx_event_participants_user ON event_participants(user_id);
CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_team_members_user       ON team_members(user_id);
CREATE INDEX idx_team_members_team       ON team_members(team_id);

-- Profiles
CREATE INDEX idx_mentor_profiles_user_id ON mentor_profiles(user_id);
CREATE INDEX idx_judge_profiles_user_id  ON judge_profiles(user_id);
