-- UCAT: Add created_by and has_timed_sets to vstudent_ucat_mocks for filtering
-- ========================

DROP VIEW IF EXISTS public.vstudent_ucat_mocks;
CREATE VIEW public.vstudent_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at,
  m.created_by,
  (SELECT COUNT(*)::INT FROM public.question_sets_ucat_mocks qsum WHERE qsum.ucat_mock_id = m.id) AS set_count,
  (
    SELECT EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks qsum
      JOIN public.question_sets qs ON qs.id = qsum.question_set_id AND qs.is_private = false AND qs.deleted_at IS NULL
      WHERE qsum.ucat_mock_id = m.id AND qs.time_limit_seconds IS NOT NULL AND qs.time_limit_seconds > 0
    )
  ) AS has_timed_sets
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND m.is_private = false AND m.deleted_at IS NULL;

GRANT SELECT ON public.vstudent_ucat_mocks TO authenticated;
