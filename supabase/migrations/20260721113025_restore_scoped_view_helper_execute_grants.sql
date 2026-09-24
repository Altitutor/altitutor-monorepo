-- SECURITY DEFINER view expressions are evaluated with the view owner's table
-- privileges, but callers still need EXECUTE on functions referenced by the
-- expression. The deny-by-default pass intentionally revoked broad function
-- execution and missed these two read-only view helpers.

REVOKE ALL ON FUNCTION public.get_ucat_subject_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ucat_subject_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.ucat_content_core_publication_issues(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_content_core_publication_issues(text, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_ucat_subject_id() IS
  'Read-only UCAT subject lookup used by authenticated student access views.';

COMMENT ON FUNCTION public.ucat_content_core_publication_issues(text, uuid) IS
  'Read-only publication validation helper used by UCAT tutor views.';
