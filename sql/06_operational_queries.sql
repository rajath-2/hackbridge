-- ============================================================
-- HackBridge — SQL 06: Operational Queries
-- These are READ queries for the backend and debugging.
-- NOT for initial setup — run any time.
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- MENTOR REQUEST STATS for an event (used by organizer dashboard)
-- Replace :event_id with the actual UUID
-- ──────────────────────────────────────────────────────────
SELECT
    t.id AS team_id,
    t.name AS team_name,
    COUNT(n.id) AS request_count
FROM notifications n
JOIN teams t ON t.id = n.team_id
WHERE n.event_id = :event_id
  AND n.type = 'mentor_request'
GROUP BY t.id, t.name
ORDER BY request_count DESC;


-- ──────────────────────────────────────────────────────────
-- CHECK MENTOR REQUEST COOLDOWN for a team
-- Returns the most recent mentor_request created_at for the team
-- Backend compares this to now() - 10 minutes
-- ──────────────────────────────────────────────────────────
SELECT created_at
FROM notifications
WHERE type = 'mentor_request'
  AND team_id = :team_id
ORDER BY created_at DESC
LIMIT 1;


-- ──────────────────────────────────────────────────────────
-- LEADERBOARD: aggregate judge scores per team per event
-- ──────────────────────────────────────────────────────────
SELECT
    t.id AS team_id,
    t.name AS team_name,
    t.final_placement,
    COUNT(DISTINCT s.judge_id) AS judge_count,
    AVG((SELECT AVG(value::numeric)
         FROM jsonb_each_text(s.rubric_scores))) AS avg_score
FROM teams t
LEFT JOIN scores s ON s.team_id = t.id AND s.event_id = :event_id
WHERE t.event_id = :event_id
GROUP BY t.id, t.name, t.final_placement
ORDER BY avg_score DESC NULLS LAST;


-- ──────────────────────────────────────────────────────────
-- PLAGIARISM FLAGS: all teams with risk level for an event
-- ──────────────────────────────────────────────────────────
SELECT
    t.id AS team_id,
    t.name AS team_name,
    t.repo_url,
    f.risk_level,
    f.git_evidence,
    f.local_scan_evidence,
    f.updated_at
FROM teams t
LEFT JOIN flags f ON f.team_id = t.id AND f.event_id = :event_id
WHERE t.event_id = :event_id
ORDER BY
    CASE f.risk_level
        WHEN 'High' THEN 1
        WHEN 'Medium' THEN 2
        ELSE 3
    END;


-- ──────────────────────────────────────────────────────────
-- RECENT COMMIT ACTIVITY for a team (mentor feed)
-- ──────────────────────────────────────────────────────────
SELECT
    cl.id,
    cl.message,
    cl.ai_summary,
    cl.files_changed,
    cl.timestamp,
    u.name AS author_name
FROM commit_logs cl
JOIN users u ON u.id = cl.user_id
WHERE cl.team_id = :team_id
ORDER BY cl.timestamp DESC
LIMIT 20;


-- ──────────────────────────────────────────────────────────
-- ALL AVAILABLE MENTORS for an event
-- (joined the event + is_available = true)
-- Used by the mentor-matching service
-- ──────────────────────────────────────────────────────────
SELECT
    u.id AS user_id,
    u.name,
    mp.expertise_tags,
    mp.bio
FROM users u
JOIN mentor_profiles mp ON mp.user_id = u.id
JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = :event_id
WHERE u.role = 'mentor'
  AND mp.is_available = true;


-- ──────────────────────────────────────────────────────────
-- EVENT OVERVIEW: teams + assigned mentors + flag summary
-- ──────────────────────────────────────────────────────────
SELECT
    t.id,
    t.name AS team_name,
    t.team_code,
    t.repo_url,
    t.final_placement,
    m.name AS mentor_name,
    COALESCE(f.risk_level, 'Clean') AS plagiarism_risk
FROM teams t
LEFT JOIN users m ON m.id = t.mentor_id
LEFT JOIN flags f ON f.team_id = t.id AND f.event_id = :event_id
WHERE t.event_id = :event_id
ORDER BY t.created_at;


-- ──────────────────────────────────────────────────────────
-- SCORES OVERVIEW: all scores for an event by round
-- ──────────────────────────────────────────────────────────
SELECT
    s.round,
    t.name AS team_name,
    u.name AS judge_name,
    s.rubric_scores,
    s.ai_suggested_scores,
    s.notes,
    s.updated_at
FROM scores s
JOIN teams t ON t.id = s.team_id
JOIN users u ON u.id = s.judge_id
WHERE s.event_id = :event_id
ORDER BY s.round, t.name;


-- ──────────────────────────────────────────────────────────
-- BROADCAST NOTIFICATIONS for an event (all dashboards)
-- ──────────────────────────────────────────────────────────
SELECT
    n.id,
    n.message,
    n.created_at,
    u.name AS sent_by
FROM notifications n
JOIN users u ON u.id = n.organizer_id
WHERE n.event_id = :event_id
  AND n.type = 'broadcast'
ORDER BY n.created_at DESC;


-- ──────────────────────────────────────────────────────────
-- COMMIT VELOCITY for a team during event
-- (commits per hour since event start_time)
-- ──────────────────────────────────────────────────────────
SELECT
    COUNT(*) AS commit_count,
    EXTRACT(EPOCH FROM (NOW() - e.start_time)) / 3600 AS hours_elapsed,
    COUNT(*) / NULLIF(EXTRACT(EPOCH FROM (NOW() - e.start_time)) / 3600, 0) AS commits_per_hour
FROM commit_logs cl
JOIN events e ON e.id = cl.event_id
WHERE cl.team_id = :team_id
  AND cl.event_id = :event_id
  AND cl.timestamp >= e.start_time
GROUP BY e.start_time;
