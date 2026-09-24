-- The background refresh worker calls the generation replacement RPC as
-- service_role. That RPC is SECURITY INVOKER and recomputes the indexed
-- maintenance watermark before returning, so its service-only helper must be
-- executable by the same worker role.
REVOKE ALL ON FUNCTION public.recompute_ucat_study_plan_maintenance_at(UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recompute_ucat_study_plan_maintenance_at(UUID)
  TO service_role;
