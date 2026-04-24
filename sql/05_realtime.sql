-- ============================================================
-- HackBridge — SQL 05: Supabase Realtime Configuration
-- Run AFTER 04_auth_trigger.sql
-- ============================================================
-- Enables realtime change streaming on the tables that need
-- live subscriptions in the frontend.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE commit_logs;

-- Verify (optional — run to confirm tables are included)
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
