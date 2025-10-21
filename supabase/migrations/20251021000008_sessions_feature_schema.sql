-- Migration: Sessions feature schema changes
-- Description:
--  - Drop sessions.subject (legacy text field)
--  - Rename absences -> student_absences (plus index/trigger renames)
--  - Create staff_swaps table (session-level add/remove swaps)
--  - Add attended boolean to sessions_staff
--  - RLS, triggers, and indexes consistent with existing patterns

-- ========================
-- DROP LEGACY COLUMN ON SESSIONS
-- ========================
ALTER TABLE public.sessions
  DROP COLUMN IF EXISTS subject;

-- ========================
-- RENAME ABSENCES -> STUDENT_ABSENCES
-- ========================
-- Table rename
DO $$
BEGIN
  IF to_regclass('public.absences') IS NOT NULL
  THEN
    ALTER TABLE public.absences RENAME TO student_absences;
  END IF;
END $$;

-- Rename indexes created in initial schema if they still exist
DO $$
BEGIN
  IF to_regclass('public.idx_absences_student_id') IS NOT NULL THEN
    ALTER INDEX public.idx_absences_student_id RENAME TO idx_student_absences_student_id;
  END IF;
  IF to_regclass('public.idx_absences_date') IS NOT NULL THEN
    ALTER INDEX public.idx_absences_date RENAME TO idx_student_absences_date;
  END IF;
END $$;

-- Ensure RLS is enabled on the renamed table
ALTER TABLE IF EXISTS public.student_absences ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on student_absences (idempotent cleanup after rename)
DO $$
DECLARE p record;
BEGIN
  FOR p IN (
    SELECT polname
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'student_absences'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.student_absences', p.polname);
  END LOOP;
END $$;

-- Create uniform ADMINSTAFF(ACTIVE) policy for student_absences
CREATE POLICY IF NOT EXISTS "ADMINSTAFF full access to student_absences" ON public.student_absences
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Rename the updated_at trigger if present to reflect new table name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'set_updated_at_absences'
      AND n.nspname = 'public'
      AND c.relname = 'student_absences'
  ) THEN
    EXECUTE 'ALTER TRIGGER set_updated_at_absences ON public.student_absences RENAME TO set_updated_at_student_absences';
  END IF;
END $$;

-- ========================
-- CREATE STAFF_SWAPS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.staff_swaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  staff_removed_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_added_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT staff_swaps_added_or_removed_chk CHECK (
    staff_removed_id IS NOT NULL OR staff_added_id IS NOT NULL
  ),
  CONSTRAINT staff_swaps_removed_not_equal_added_chk CHECK (
    staff_removed_id IS NULL OR staff_added_id IS NULL OR staff_removed_id <> staff_added_id
  )
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_staff_swaps_session_id ON public.staff_swaps(session_id);
CREATE INDEX IF NOT EXISTS idx_staff_swaps_staff_removed_id ON public.staff_swaps(staff_removed_id);
CREATE INDEX IF NOT EXISTS idx_staff_swaps_staff_added_id ON public.staff_swaps(staff_added_id);
CREATE INDEX IF NOT EXISTS idx_staff_swaps_created_by ON public.staff_swaps(created_by);

-- RLS and policies for staff_swaps
ALTER TABLE public.staff_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to staff_swaps" ON public.staff_swaps;
CREATE POLICY "ADMINSTAFF full access to staff_swaps" ON public.staff_swaps
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- updated_at trigger for staff_swaps
DROP TRIGGER IF EXISTS set_updated_at_staff_swaps ON public.staff_swaps;
CREATE TRIGGER set_updated_at_staff_swaps
BEFORE UPDATE ON public.staff_swaps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- ADD attended TO SESSIONS_STAFF
-- ========================
ALTER TABLE public.sessions_staff
  ADD COLUMN IF NOT EXISTS attended BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to accelerate actual attendance queries
CREATE INDEX IF NOT EXISTS idx_sessions_staff_attended ON public.sessions_staff(attended);

-- Add created_by to sessions_staff (for auditability)
ALTER TABLE public.sessions_staff
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff(id);

-- Add created_by to sessions_students (for auditability)
ALTER TABLE public.sessions_students
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff(id);

-- Helpful composite indexes for frequent lookups
CREATE INDEX IF NOT EXISTS idx_sessions_staff_session_id_attended ON public.sessions_staff(session_id, attended);
CREATE INDEX IF NOT EXISTS idx_sessions_students_session_id_attended ON public.sessions_students(session_id, attended);
CREATE INDEX IF NOT EXISTS idx_student_absences_missed_session_id ON public.student_absences(missed_session_id);

-- Prevent duplicate identical swaps per session via a partial unique index
-- Note: allow multiple entries when one of the staff ids is null; we only enforce
-- uniqueness when BOTH ids are provided (common duplication source)
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_swaps_session_removed_added
ON public.staff_swaps(session_id, staff_removed_id, staff_added_id)
WHERE staff_removed_id IS NOT NULL AND staff_added_id IS NOT NULL;

-- Secondary partial unique indexes to prevent duplicate pure-add or pure-remove events
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_swaps_session_added_only
ON public.staff_swaps(session_id, staff_added_id)
WHERE staff_removed_id IS NULL AND staff_added_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_swaps_session_removed_only
ON public.staff_swaps(session_id, staff_removed_id)
WHERE staff_added_id IS NULL AND staff_removed_id IS NOT NULL;


