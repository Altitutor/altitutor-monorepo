-- Migration: UCAT images files RLS
-- Description:
--  - Allow UCAT tutors (not just ADMINSTAFF) to manage file records
--    for UCAT images in the shared files table.
--  - Scope tutor access to rows where bucket = 'ucat-images'.
--
-- This migration complements:
--  - 20260225132000_ucat_images_bucket.sql (storage bucket + storage RLS)
--  - 20260225133000_ucat_question_stems_files.sql (join table + RPC linking)

-- Ensure files table has RLS enabled (idempotent)
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Drop existing UCAT-specific policy if re-running
DROP POLICY IF EXISTS "UCAT tutors manage ucat-images files" ON public.files;

-- UCAT tutors: full manage access for ucat-images rows only.
-- ADMINSTAFF already have full access via existing adminstaff_all_files policy.
CREATE POLICY "UCAT tutors manage ucat-images files"
ON public.files
FOR ALL
TO authenticated
USING (
  bucket = 'ucat-images'
  AND (SELECT public.is_ucat_tutor())
)
WITH CHECK (
  bucket = 'ucat-images'
  AND (SELECT public.is_ucat_tutor())
);

