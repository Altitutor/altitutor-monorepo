-- The retention wrapper recreated this facade without its declared options.
-- ALTER preserves the current projection, publication and retirement predicates.
ALTER VIEW public.vmarketing_staff_profiles
  SET (security_invoker = false, security_barrier = true);

-- A later SELECT grant does not remove privileges inherited from earlier grants.
-- This is an intentional public read facade, including for signed-in visitors.
REVOKE ALL ON public.vmarketing_staff_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vmarketing_staff_profiles TO anon, authenticated;
