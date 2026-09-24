-- New public tables inherit no privileges (deny-by-default). Without this,
-- embedding project_members in a projects select 403s the entire list.

REVOKE ALL ON TABLE public.project_members FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_members TO authenticated;
