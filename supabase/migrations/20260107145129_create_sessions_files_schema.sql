-- Migration: Create sessions_files table for linking files to sessions
-- Description:
--  - Create sessions_files junction table
--  - Add RLS policies for students, tutors, and ADMINSTAFF
--  - Create indexes for performance

-- ========================
-- CREATE sessions_files TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.sessions_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  
  -- Ensure no duplicate file-session pairs
  CONSTRAINT sessions_files_unique_session_file UNIQUE(session_id, file_id)
);

-- ========================
-- CREATE INDEXES
-- ========================

CREATE INDEX IF NOT EXISTS idx_sessions_files_session_id ON public.sessions_files(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_files_file_id ON public.sessions_files(file_id);
CREATE INDEX IF NOT EXISTS idx_sessions_files_created_by ON public.sessions_files(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_files_display_order ON public.sessions_files(session_id, display_order);

-- ========================
-- CREATE TRIGGERS
-- ========================

-- Standard updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_sessions_files ON public.sessions_files;
CREATE TRIGGER set_updated_at_sessions_files
BEFORE UPDATE ON public.sessions_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- ENABLE RLS
-- ========================

ALTER TABLE public.sessions_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Students can access files for their sessions" ON public.sessions_files;
DROP POLICY IF EXISTS "Tutors can access files for their sessions" ON public.sessions_files;
DROP POLICY IF EXISTS "ADMINSTAFF full access to sessions_files" ON public.sessions_files;

-- ========================
-- RLS POLICIES
-- ========================

-- Students: SELECT, INSERT, UPDATE, DELETE for sessions they're enrolled in
CREATE POLICY "Students can access files for their sessions" ON public.sessions_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions_students ss
      WHERE ss.session_id = sessions_files.session_id
        AND ss.student_id = public.current_student_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sessions_students ss
      WHERE ss.session_id = sessions_files.session_id
        AND ss.student_id = public.current_student_id()
    )
  );

-- Tutors: SELECT, INSERT, UPDATE, DELETE for sessions they're assigned to
CREATE POLICY "Tutors can access files for their sessions" ON public.sessions_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions_staff ssf
      WHERE ssf.session_id = sessions_files.session_id
        AND ssf.staff_id = public.current_tutor_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sessions_staff ssf
      WHERE ssf.session_id = sessions_files.session_id
        AND ssf.staff_id = public.current_tutor_id()
    )
  );

-- ADMINSTAFF: Full access
CREATE POLICY "ADMINSTAFF full access to sessions_files" ON public.sessions_files
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- COMMENTS
-- ========================

COMMENT ON TABLE public.sessions_files IS 'Junction table linking sessions to files. Allows students and tutors to manage files for their sessions.';
COMMENT ON COLUMN public.sessions_files.display_order IS 'Order for displaying files in UI (0-based)';
COMMENT ON COLUMN public.sessions_files.created_by IS 'Staff member who created the link (NULL for student uploads)';

