-- Migration: Add patch column to commit_logs for local AI verification
ALTER TABLE public.commit_logs ADD COLUMN IF NOT EXISTS patch TEXT;
