-- The Study plan unskip API invokes this guard with its service-role client.
-- State the server-only contract explicitly rather than relying on creator defaults.
REVOKE ALL ON FUNCTION public.ucat_study_plan_task_has_active_work(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ucat_study_plan_task_has_active_work(UUID)
  TO service_role;
