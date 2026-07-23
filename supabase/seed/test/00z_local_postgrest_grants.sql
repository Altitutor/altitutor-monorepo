-- Reproduce the hosted project's role grants without undoing the production
-- deny-by-default migration. RLS still separates authenticated roles, while
-- anonymous relation/function access remains explicitly allowlisted.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT ON public.vmarketing_staff_profiles TO anon;
