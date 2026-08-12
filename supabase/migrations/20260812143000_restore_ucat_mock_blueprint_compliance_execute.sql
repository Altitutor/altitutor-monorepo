-- Same class of bug as 20260812140000: 20260810190000 revoked EXECUTE on
-- ucat_mock_blueprint_compliance from authenticated, but vtutor_ucat_question_sets
-- (and mock list/detail views) call it directly in their SELECT list. Postgres
-- checks function EXECUTE as the current role, so /ucat/questions set lookups 403.

GRANT EXECUTE ON FUNCTION public.ucat_mock_blueprint_compliance(UUID)
  TO authenticated;

ALTER VIEW public.vtutor_ucat_mocks SET (security_invoker = false);
ALTER VIEW public.vtutor_ucat_mock_detail SET (security_invoker = false);
