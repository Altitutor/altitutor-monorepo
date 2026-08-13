-- 20260810190000 revoked EXECUTE on ucat_content_publication_issues from authenticated
-- intending "views invoke as owner". Postgres still checks function EXECUTE as the
-- current role, so vtutor_ucat_question_sets / _stem_detail (and mocks) 403 for tutors.
-- Restore authenticated EXECUTE so guarded tutor views can evaluate publication_issues.

GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  TO authenticated;

-- Align with other vtutor_* views created with an explicit invoker=false option.
ALTER VIEW public.vtutor_ucat_question_sets SET (security_invoker = false);
ALTER VIEW public.vtutor_ucat_question_stem_detail SET (security_invoker = false);
