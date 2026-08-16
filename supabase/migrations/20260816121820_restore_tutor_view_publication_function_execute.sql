-- 20260813150000 revoked EXECUTE on these helpers from authenticated, intending
-- "views invoke as owner". Postgres still checks function EXECUTE as the current
-- role, so vtutor_ucat_question_sets / _stem_detail / _mocks / _mock_detail /
-- _question_set_detail 403 for tutors (same class of bug as 20260812140000 and
-- 20260812143000).
--
-- These SECURITY DEFINER helpers are only reached from guarded tutor views.
-- Direct RPC remains available to authenticated, matching the 20260812 restore.

GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.ucat_mock_blueprint_compliance(UUID)
  TO authenticated;
