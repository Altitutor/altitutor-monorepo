-- Topic hierarchy helpers are intentionally private after the public-function
-- hardening migration. Run their trigger entry points with the trigger owner so
-- authenticated ADMINSTAFF mutations can still invoke the private helpers.
ALTER FUNCTION public.trigger_recalculate_descendants_after_update()
  SECURITY DEFINER;
ALTER FUNCTION public.trigger_recalculate_descendants_after_update()
  SET search_path = public;

ALTER FUNCTION public.trigger_process_deferred_topic_recalc()
  SECURITY DEFINER;
ALTER FUNCTION public.trigger_process_deferred_topic_recalc()
  SET search_path = public;

ALTER FUNCTION public.trigger_recalculate_topic_siblings_after_delete()
  SECURITY DEFINER;
ALTER FUNCTION public.trigger_recalculate_topic_siblings_after_delete()
  SET search_path = public;

REVOKE ALL ON FUNCTION public.trigger_recalculate_descendants_after_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_process_deferred_topic_recalc()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_topic_siblings_after_delete()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.trigger_recalculate_descendants_after_update()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_process_deferred_topic_recalc()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_topic_siblings_after_delete()
  TO service_role;
