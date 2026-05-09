-- Tutor-facing subject cover images (same shape as vstudent_subject_images; scoped to vtutor_subjects).

CREATE OR REPLACE VIEW public.vtutor_subject_images
WITH (security_invoker = false)
AS
SELECT
  sf.subject_id,
  f.id AS file_id,
  f.filename,
  f.mimetype,
  f.storage_path,
  f.bucket,
  f.storage_provider,
  f.metadata AS file_metadata,
  f.deleted_at,
  sf.created_at,
  sf.updated_at
FROM public.subjects_files sf
JOIN public.files f ON f.id = sf.file_id
WHERE sf.subject_id IN (SELECT id FROM public.vtutor_subjects)
  AND f.deleted_at IS NULL;

GRANT SELECT ON public.vtutor_subject_images TO authenticated;

COMMENT ON VIEW public.vtutor_subject_images IS 'Tutor view: one cover image file per authorized subject.';
