-- Normalize the caller-facing grants used during UCAT signup and the
-- service-role-only cache read used by Study-plan maintenance. Explicit grants
-- make this repair safe to redrive after view recreation or privilege drift.

REVOKE ALL ON public.vstudent_profile
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vstudent_profile
  TO authenticated, service_role;

REVOKE ALL ON public.vstudent_ucat_my_access
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vstudent_ucat_my_access
  TO authenticated, service_role;

REVOKE ALL ON public.ucat_public_question_counts_cache
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ucat_public_question_counts_cache
  TO service_role;
