-- Migration: Link mentors and judges to events
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE judge_profiles ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- Optional: Populate event_id from event_participants if exists
UPDATE mentor_profiles mp
SET event_id = ep.event_id
FROM event_participants ep
WHERE mp.user_id = ep.user_id
AND mp.event_id IS NULL;

UPDATE judge_profiles jp
SET event_id = ep.event_id
FROM event_participants ep
WHERE jp.user_id = ep.user_id
AND jp.event_id IS NULL;
