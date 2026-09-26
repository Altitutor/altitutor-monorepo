-- student_files was created after the deny-by-default privilege migration, so
-- authenticated admin clients receive 42501 before RLS is evaluated.
REVOKE ALL ON TABLE public.student_files FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_files TO authenticated;
GRANT ALL ON TABLE public.student_files TO service_role;
