-- Migration: Rebuild sessions_staff table for planned attendance tracking
-- Description:
--  - Drop existing sessions_staff table
--  - Create new table with planned absence and swap tracking
--  - Add constraints, triggers, indexes, and RLS policies

-- ========================
-- DROP EXISTING TABLE
-- ========================
DROP TABLE IF EXISTS public.sessions_staff CASCADE;

-- ========================
-- CREATE NEW sessions_staff TABLE
-- ========================
CREATE TABLE public.sessions_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'MAIN_TUTOR',
  planned_absence BOOLEAN NOT NULL DEFAULT FALSE,
  planned_absence_logged_at TIMESTAMPTZ,
  planned_absence_logged_by UUID REFERENCES public.staff(id),
  is_swapped BOOLEAN NOT NULL DEFAULT FALSE,
  swapped_sessions_staff_id UUID REFERENCES public.sessions_staff(id) ON DELETE SET NULL,
  swapped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  
  -- Constraints
  CONSTRAINT sessions_staff_unique_session_staff UNIQUE(session_id, staff_id),
  CONSTRAINT sessions_staff_type_check CHECK (type IN ('MAIN_TUTOR', 'SECONDARY_TUTOR', 'TRIAL_TUTOR')),
  CONSTRAINT sessions_staff_swapped_requires_absence CHECK (
    NOT is_swapped OR planned_absence = TRUE
  ),
  CONSTRAINT sessions_staff_swapped_id_requires_flag CHECK (
    swapped_sessions_staff_id IS NULL OR is_swapped = TRUE
  )
);

-- ========================
-- CREATE INDEXES
-- ========================
CREATE INDEX idx_sessions_staff_session_id ON public.sessions_staff(session_id);
CREATE INDEX idx_sessions_staff_staff_id ON public.sessions_staff(staff_id);
CREATE INDEX idx_sessions_staff_type ON public.sessions_staff(type);
CREATE INDEX idx_sessions_staff_planned_absence ON public.sessions_staff(planned_absence);
CREATE INDEX idx_sessions_staff_is_swapped ON public.sessions_staff(is_swapped);
CREATE INDEX idx_sessions_staff_created_by ON public.sessions_staff(created_by);

-- ========================
-- CREATE TRIGGERS
-- ========================

-- Trigger to set planned_absence_logged_at when planned_absence becomes TRUE
CREATE OR REPLACE FUNCTION public.set_sessions_staff_planned_absence_logged_at()
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

DROP TRIGGER IF EXISTS trigger_sessions_staff_planned_absence_logged_at ON public.sessions_staff;
CREATE TRIGGER trigger_sessions_staff_planned_absence_logged_at
BEFORE INSERT OR UPDATE ON public.sessions_staff
FOR EACH ROW EXECUTE FUNCTION public.set_sessions_staff_planned_absence_logged_at();

-- Trigger to set swapped_at when is_swapped becomes TRUE
CREATE OR REPLACE FUNCTION public.set_sessions_staff_swapped_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_swapped = TRUE AND (OLD IS NULL OR OLD.is_swapped = FALSE) THEN
    NEW.swapped_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sessions_staff_swapped_at ON public.sessions_staff;
CREATE TRIGGER trigger_sessions_staff_swapped_at
BEFORE INSERT OR UPDATE ON public.sessions_staff
FOR EACH ROW EXECUTE FUNCTION public.set_sessions_staff_swapped_at();

-- Standard updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_sessions_staff ON public.sessions_staff;
CREATE TRIGGER set_updated_at_sessions_staff
BEFORE UPDATE ON public.sessions_staff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- ENABLE RLS
-- ========================
ALTER TABLE public.sessions_staff ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "ADMINSTAFF full access to sessions_staff" ON public.sessions_staff;

-- Create ADMINSTAFF policy
CREATE POLICY "ADMINSTAFF full access to sessions_staff" ON public.sessions_staff
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());


