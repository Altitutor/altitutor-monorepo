-- UCAT: expose linked stem resources in tutor sessions resources view
-- Keeps tutor-web typed reads aligned with ucat_sessions_resources schema.

DROP VIEW IF EXISTS public.vtutor_ucat_sessions_resources;

CREATE VIEW public.vtutor_ucat_sessions_resources
WITH (security_invoker = false)
AS
SELECT
  usr.id,
  usr.session_id,
  usr.question_set_id,
  usr.ucat_mock_id,
  usr.question_stem_id,
  usr.index,
  usr.created_by,
  usr.created_at
FROM public.ucat_sessions_resources usr
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_sessions_resources TO authenticated;
