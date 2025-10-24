-- Migration: Rebuild sessions_students table for planned attendance tracking
-- Description:
--  - Drop existing sessions_students table
--  - Create new table with planned absence, rescheduling, and credit tracking
--  - Add constraints, triggers, indexes, and RLS policies

-- ========================
-- DROP EXISTING TABLE
-- ========================
DROP TABLE IF EXISTS public.sessions_students CASCADE;

-- ========================
-- CREATE NEW sessions_students TABLE
-- ========================
CREATE TABLE public.sessions_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  planned_absence BOOLEAN NOT NULL DEFAULT FALSE,
  planned_absence_logged_at TIMESTAMPTZ,
  planned_absence_logged_by UUID REFERENCES public.staff(id),
  is_rescheduled BOOLEAN NOT NULL DEFAULT FALSE,
  rescheduled_sessions_students_id UUID REFERENCES public.sessions_students(id) ON DELETE SET NULL,
  rescheduled_at TIMESTAMPTZ,
  is_credited BOOLEAN NOT NULL DEFAULT FALSE,
  credited_by UUID REFERENCES public.staff(id),
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  
  -- Constraints
  CONSTRAINT sessions_students_unique_session_student UNIQUE(session_id, student_id),
  CONSTRAINT sessions_students_rescheduled_requires_absence CHECK (
    NOT is_rescheduled OR planned_absence = TRUE
  ),
  CONSTRAINT sessions_students_rescheduled_id_requires_flag CHECK (
    rescheduled_sessions_students_id IS NULL OR is_rescheduled = TRUE
  ),
  CONSTRAINT sessions_students_credited_requires_absence CHECK (
    NOT is_credited OR planned_absence = TRUE
  ),
  CONSTRAINT sessions_students_credited_excludes_rescheduled CHECK (
    NOT is_credited OR is_rescheduled = FALSE
  )
);

-- ========================
-- CREATE INDEXES
-- ========================
CREATE INDEX idx_sessions_students_session_id ON public.sessions_students(session_id);
CREATE INDEX idx_sessions_students_student_id ON public.sessions_students(student_id);
CREATE INDEX idx_sessions_students_planned_absence ON public.sessions_students(planned_absence);
CREATE INDEX idx_sessions_students_is_rescheduled ON public.sessions_students(is_rescheduled);
CREATE INDEX idx_sessions_students_is_credited ON public.sessions_students(is_credited);
CREATE INDEX idx_sessions_students_created_by ON public.sessions_students(created_by);

-- ========================
-- CREATE TRIGGERS
-- ========================

-- Trigger to set planned_absence_logged_at when planned_absence becomes TRUE
CREATE OR REPLACE FUNCTION public.set_sessions_students_planned_absence_logged_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.planned_absence = TRUE AND (OLD IS NULL OR OLD.planned_absence = FALSE) THEN
    NEW.planned_absence_logged_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sessions_students_planned_absence_logged_at ON public.sessions_students;
CREATE TRIGGER trigger_sessions_students_planned_absence_logged_at
BEFORE INSERT OR UPDATE ON public.sessions_students
FOR EACH ROW EXECUTE FUNCTION public.set_sessions_students_planned_absence_logged_at();

-- Trigger to set rescheduled_at when is_rescheduled becomes TRUE
CREATE OR REPLACE FUNCTION public.set_sessions_students_rescheduled_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_rescheduled = TRUE AND (OLD IS NULL OR OLD.is_rescheduled = FALSE) THEN
    NEW.rescheduled_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sessions_students_rescheduled_at ON public.sessions_students;
CREATE TRIGGER trigger_sessions_students_rescheduled_at
BEFORE INSERT OR UPDATE ON public.sessions_students
FOR EACH ROW EXECUTE FUNCTION public.set_sessions_students_rescheduled_at();

-- Trigger to set credited_at when is_credited becomes TRUE
CREATE OR REPLACE FUNCTION public.set_sessions_students_credited_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_credited = TRUE AND (OLD IS NULL OR OLD.is_credited = FALSE) THEN
    NEW.credited_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sessions_students_credited_at ON public.sessions_students;
CREATE TRIGGER trigger_sessions_students_credited_at
BEFORE INSERT OR UPDATE ON public.sessions_students
FOR EACH ROW EXECUTE FUNCTION public.set_sessions_students_credited_at();

-- Standard updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_sessions_students ON public.sessions_students;
CREATE TRIGGER set_updated_at_sessions_students
BEFORE UPDATE ON public.sessions_students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- ENABLE RLS
-- ========================
ALTER TABLE public.sessions_students ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "ADMINSTAFF full access to sessions_students" ON public.sessions_students;

-- Create ADMINSTAFF policy
CREATE POLICY "ADMINSTAFF full access to sessions_students" ON public.sessions_students
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

