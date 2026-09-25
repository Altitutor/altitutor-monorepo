-- Migration: Student files for admin-web, matching staff_files
-- Description:
--  - Create student_files junction table
--  - Create student-files storage bucket with ADMINSTAFF RLS
--  - Expose the junction table to admin reporting

-- ========================
-- CREATE student_files TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.student_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  display_name TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),

  CONSTRAINT student_files_unique_student_file UNIQUE(student_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_student_files_student_id ON public.student_files(student_id);
CREATE INDEX IF NOT EXISTS idx_student_files_file_id ON public.student_files(file_id);
CREATE INDEX IF NOT EXISTS idx_student_files_created_by ON public.student_files(created_by);
CREATE INDEX IF NOT EXISTS idx_student_files_display_order ON public.student_files(student_id, display_order);

DROP TRIGGER IF EXISTS set_updated_at_student_files ON public.student_files;
CREATE TRIGGER set_updated_at_student_files
BEFORE UPDATE ON public.student_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.student_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to student_files" ON public.student_files;

CREATE POLICY "ADMINSTAFF full access to student_files" ON public.student_files
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

COMMENT ON TABLE public.student_files IS 'Junction table linking students to files. Allows ADMINSTAFF to manage files for students.';
COMMENT ON COLUMN public.student_files.display_name IS 'Optional custom display name for the file. If NULL, falls back to files.filename';
COMMENT ON COLUMN public.student_files.display_order IS 'Order for displaying files in UI (0-based)';
COMMENT ON COLUMN public.student_files.created_by IS 'Staff member who created the link';

-- ========================
-- CREATE STORAGE BUCKET
-- ========================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-files',
  'student-files',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "ADMINSTAFF full access to student-files" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to student-files"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''student-files'' AND
        (SELECT public.is_adminstaff_active())
      )
      WITH CHECK (
        bucket_id = ''student-files'' AND
        (SELECT public.is_adminstaff_active())
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ADMINSTAFF policy creation - insufficient privileges';
  END;
END $$;

-- ========================
-- ADMIN REPORTING
-- ========================

CREATE VIEW admin_reporting.student_files WITH (security_barrier = true) AS
  SELECT
    id,
    student_id,
    file_id,
    display_order,
    created_at,
    updated_at,
    created_by,
    display_name
  FROM public.student_files;

REVOKE ALL ON admin_reporting.student_files FROM public, anon, authenticated;
GRANT SELECT ON admin_reporting.student_files TO admin_reporting_reader;
