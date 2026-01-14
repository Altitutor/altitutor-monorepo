-- Migration: Create Staff Notepad Table
-- Description:
--  - Create staff_notepad table for user-specific notepad storage
--  - Each admin staff member has their own notepad
--  - RLS policies ensure users can only access their own notepad
-- Purpose: Enable admin staff to have a persistent scratchpad/notepad across sessions

-- ========================
-- CREATE STAFF_NOTEPAD TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.staff_notepad (
  staff_id UUID PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  content TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance (though primary key already provides index)
-- No additional index needed since staff_id is primary key

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_staff_notepad ON public.staff_notepad;
CREATE TRIGGER set_updated_at_staff_notepad
BEFORE UPDATE ON public.staff_notepad
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Comments
COMMENT ON TABLE public.staff_notepad IS 'User-specific notepad for admin staff members';
COMMENT ON COLUMN public.staff_notepad.staff_id IS 'References staff.id - one notepad per staff member';
COMMENT ON COLUMN public.staff_notepad.content IS 'Notepad content (multiline text)';
COMMENT ON COLUMN public.staff_notepad.updated_at IS 'Timestamp of last update';

-- ========================
-- RLS POLICIES
-- ========================
ALTER TABLE public.staff_notepad ENABLE ROW LEVEL SECURITY;

-- AdminStaff can manage their own notepad
-- Using cached subquery pattern for performance
DROP POLICY IF EXISTS "AdminStaff can manage own notepad" ON public.staff_notepad;
CREATE POLICY "AdminStaff can manage own notepad" ON public.staff_notepad
  FOR ALL TO authenticated
  USING (
    staff_id = (SELECT id FROM public.staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF' AND status = 'ACTIVE')
  )
  WITH CHECK (
    staff_id = (SELECT id FROM public.staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF' AND status = 'ACTIVE')
  );
