-- Expose mock creator staff names on vtutor_ucat_mocks (matches vtutor_ucat_question_sets).

DROP VIEW IF EXISTS public.vtutor_ucat_mocks;
CREATE VIEW public.vtutor_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.is_private,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  m.deleted_at,
  m.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT COUNT(*)::INT FROM public.question_sets_ucat_mocks qsum WHERE qsum.ucat_mock_id = m.id) AS set_count
FROM public.ucat_mocks m
LEFT JOIN public.staff created_staff ON created_staff.id = m.created_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mocks TO authenticated;
