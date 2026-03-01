-- ========================
-- UCAT: Add set_count to vtutor_ucat_mocks and vstudent_ucat_mocks
-- ========================

DROP VIEW IF EXISTS public.vtutor_ucat_mocks;
CREATE OR REPLACE VIEW public.vtutor_ucat_mocks
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
  (SELECT COUNT(*)::INT FROM public.question_sets_ucat_mocks qsum WHERE qsum.ucat_mock_id = m.id) AS set_count
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mocks TO authenticated;

DROP VIEW IF EXISTS public.vstudent_ucat_mocks;
CREATE OR REPLACE VIEW public.vstudent_ucat_mocks
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.created_at,
  m.updated_at,
  (SELECT COUNT(*)::INT FROM public.question_sets_ucat_mocks qsum WHERE qsum.ucat_mock_id = m.id) AS set_count
FROM public.ucat_mocks m
WHERE public.is_ucat_student() AND m.is_private = false;

GRANT SELECT ON public.vstudent_ucat_mocks TO authenticated;
