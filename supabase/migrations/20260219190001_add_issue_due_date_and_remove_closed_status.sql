-- Migration: Add due_date to issues and remove closed status
-- Description: Adds issues.due_date, removes 'closed' status option, and updates existing closed rows
-- Author: AI Assistant
-- Date: 2026-02-19

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

UPDATE public.issues
SET status = 'resolved'
WHERE status = 'closed';

ALTER TABLE public.issues
  DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE public.issues
  ADD CONSTRAINT issues_status_check
  CHECK (status IN ('open', 'awaiting_response', 'resolved'));

CREATE INDEX IF NOT EXISTS idx_issues_due_date
  ON public.issues(due_date)
  WHERE due_date IS NOT NULL;
