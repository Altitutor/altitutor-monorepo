-- Migration: Create staff_files table for linking files to staff
-- Description:
--  - Create staff_files junction table
--  - Add RLS policies for ADMINSTAFF
--  - Create indexes for performance

-- ========================
-- CREATE staff_files TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.staff_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  
  -- Ensure no duplicate file-staff pairs
  CONSTRAINT staff_files_unique_staff_file UNIQUE(staff_id, file_id)
);

-- ========================
-- CREATE INDEXES
-- ========================

CREATE INDEX IF NOT EXISTS idx_staff_files_staff_id ON public.staff_files(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_files_file_id ON public.staff_files(file_id);
CREATE INDEX IF NOT EXISTS idx_staff_files_created_by ON public.staff_files(created_by);
CREATE INDEX IF NOT EXISTS idx_staff_files_display_order ON public.staff_files(staff_id, display_order);

-- ========================
-- CREATE TRIGGERS
-- ========================

-- Standard updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_staff_files ON public.staff_files;
CREATE TRIGGER set_updated_at_staff_files
BEFORE UPDATE ON public.staff_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- ENABLE RLS
-- ========================

ALTER TABLE public.staff_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "ADMINSTAFF full access to staff_files" ON public.staff_files;

-- ========================
-- RLS POLICIES
-- ========================

-- ADMINSTAFF: Full access
CREATE POLICY "ADMINSTAFF full access to staff_files" ON public.staff_files
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- COMMENTS
-- ========================

COMMENT ON TABLE public.staff_files IS 'Junction table linking staff to files. Allows ADMINSTAFF to manage files for staff members.';
COMMENT ON COLUMN public.staff_files.display_order IS 'Order for displaying files in UI (0-based)';
COMMENT ON COLUMN public.staff_files.created_by IS 'Staff member who created the link';
