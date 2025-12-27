-- Migration: Add status column to sessions table
-- Description:
--   - Add status column to sessions table (ACTIVE/INACTIVE)
--   - Set default status for existing sessions based on their class status
--   - Add check constraint and index

-- ========================
-- ADD STATUS COLUMN TO SESSIONS
-- ========================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

-- Add check constraint
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sessions_status 
  ON public.sessions(status);

-- Set default status for existing sessions based on their class status
UPDATE public.sessions s
SET status = c.status
FROM public.classes c
WHERE s.class_id = c.id;

-- For sessions without a class (shouldn't happen for CLASS type, but handle gracefully)
-- Keep them as ACTIVE (already set by DEFAULT)

