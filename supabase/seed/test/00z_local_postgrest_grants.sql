-- Reproduce the hosted project's role grants without undoing the production
-- deny-by-default migration. RLS still separates authenticated roles, while
-- anonymous relation/function access remains explicitly allowlisted.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- The blanket hosted-role emulation above runs after migrations during a local
-- reset. Re-apply intentional relation-level denials that production receives
-- from its later migration ordering.
REVOKE ALL ON TABLE public.public_link_revocations
  FROM PUBLIC, anon, authenticated, service_role;

-- Preserve the UCAT runtime boundaries restored by
-- 20260902060000_restore_ucat_runtime_read_privileges.sql. The blanket local
-- grant above intentionally emulates hosted defaults, so production-specific
-- deny rules must be repeated after it.
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

GRANT SELECT ON public.vmarketing_staff_profiles TO anon;
