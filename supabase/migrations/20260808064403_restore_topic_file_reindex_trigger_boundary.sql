-- The authenticated deny-by-default pass intentionally removed direct access
-- to internal SECURITY DEFINER helpers. Topic-file update/delete triggers were
-- still SECURITY INVOKER, so an otherwise-authorized ADMINSTAFF write failed
-- when the trigger called the now-private sibling reindex helper.
--
-- Keep the helper private. Trigger functions receive no client-controlled
-- arguments and can only reindex the OLD/NEW groups of a row whose table write
-- has already passed RLS, so they are the narrow privilege boundary.

ALTER FUNCTION public.recalculate_topic_file_indices_for_siblings(
  uuid,
  public.resource_type,
  boolean
)
  SET search_path = public;

ALTER FUNCTION public.trigger_recalculate_topic_file_siblings_after_update()
  SECURITY DEFINER
  SET search_path = public;

ALTER FUNCTION public.trigger_recalculate_topic_file_siblings_after_delete()
  SECURITY DEFINER
  SET search_path = public;

REVOKE ALL ON FUNCTION public.trigger_recalculate_topic_file_siblings_after_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_topic_file_siblings_after_delete()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.trigger_recalculate_topic_file_siblings_after_update()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_topic_file_siblings_after_delete()
  TO service_role;
