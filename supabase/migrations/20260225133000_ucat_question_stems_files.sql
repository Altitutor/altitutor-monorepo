-- Migration: Create question_stems_files join table
-- Description:
--  - Join table linking UCAT question stems to file records
--  - Mirrors questions_files pattern for stems
--  - Adds ADMINSTAFF RLS policy; tutors/students access via views/RPCs

-- ========================
-- question_stems_files
-- ========================

CREATE TABLE IF NOT EXISTS public.question_stems_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_stem_id UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  UNIQUE (question_stem_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_question_stems_files_stem
  ON public.question_stems_files(question_stem_id);

CREATE INDEX IF NOT EXISTS idx_question_stems_files_file
  ON public.question_stems_files(file_id);

-- Enable RLS and grant ADMINSTAFF full access, consistent with other UCAT tables

ALTER TABLE public.question_stems_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "ADMINSTAFF full access to question_stems_files" ON public.question_stems_files;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  EXECUTE '
    CREATE POLICY "ADMINSTAFF full access to question_stems_files"
    ON public.question_stems_files
    FOR ALL
    TO authenticated
    USING ((SELECT public.is_adminstaff_active()))
    WITH CHECK ((SELECT public.is_adminstaff_active()))
  ';
END $$;

