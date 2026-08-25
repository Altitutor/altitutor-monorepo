-- Reconciliation can touch many tasks and their companion reviews. Apply the
-- heterogeneous patches in one database round trip while retaining row-level
-- ownership checks.
CREATE OR REPLACE FUNCTION public.batch_update_ucat_study_plan_tasks(
  p_student_id uuid,
  p_updates jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_patch jsonb; v_count integer := 0;
BEGIN
  IF jsonb_typeof(coalesce(p_updates, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'updates_must_be_an_array';
  END IF;
  FOR v_patch IN SELECT value FROM jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  LOOP
    UPDATE public.ucat_student_study_plan_tasks task
    SET
      status = CASE WHEN v_patch ? 'status' THEN v_patch ->> 'status' ELSE task.status END,
      completed_at = CASE WHEN v_patch ? 'completed_at'
        THEN (v_patch ->> 'completed_at')::timestamptz ELSE task.completed_at END,
      completed_units = CASE WHEN v_patch ? 'completed_units'
        THEN (v_patch ->> 'completed_units')::numeric ELSE task.completed_units END,
      matched_activity_type = CASE WHEN v_patch ? 'matched_activity_type'
        THEN v_patch ->> 'matched_activity_type' ELSE task.matched_activity_type END,
      matched_activity_id = CASE WHEN v_patch ? 'matched_activity_id'
        THEN (v_patch ->> 'matched_activity_id')::uuid ELSE task.matched_activity_id END,
      launch_path = CASE WHEN v_patch ? 'launch_path'
        THEN v_patch ->> 'launch_path' ELSE task.launch_path END,
      launch_config = CASE WHEN v_patch ? 'launch_config'
        THEN v_patch -> 'launch_config' ELSE task.launch_config END,
      updated_at = now()
    WHERE task.id = (v_patch ->> 'id')::uuid
      AND task.student_id = p_student_id;
    v_count := v_count + CASE WHEN FOUND THEN 1 ELSE 0 END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.batch_update_ucat_study_plan_tasks(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.batch_update_ucat_study_plan_tasks(uuid, jsonb)
  TO service_role;
