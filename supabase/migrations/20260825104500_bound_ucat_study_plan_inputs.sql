-- Study-plan generation only needs to know which trainers have at least one
-- eligible item; do not download every item merely to construct that set.
CREATE OR REPLACE FUNCTION public.get_ucat_skill_trainers_with_items()
RETURNS TABLE(skill_trainer_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT DISTINCT item.skill_trainer_id
  FROM public.ucat_skill_trainer_items item
  WHERE item.is_active = true
    AND item.approval_status = 'approved'
    AND item.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_ucat_skill_trainers_with_items()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ucat_skill_trainers_with_items()
  TO service_role;
