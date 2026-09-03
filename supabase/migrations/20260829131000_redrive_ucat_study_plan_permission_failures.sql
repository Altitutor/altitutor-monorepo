-- The missing worker-helper grant caused otherwise valid preparation refreshes
-- to exhaust their bounded retries. Once the grant is present, redrive only
-- dead letters that match this exact PostgreSQL permission failure so existing
-- students recover without waiting for another authenticated visit.
DO $$
DECLARE
  v_student_id UUID;
BEGIN
  FOR v_student_id IN
    SELECT request.student_id
    FROM public.ucat_student_preparation_refresh_requests AS request
    WHERE request.dead_lettered_at IS NOT NULL
      AND request.last_error ILIKE
        '%permission denied for function recompute_ucat_study_plan_maintenance_at%'
      AND request.last_error ~ '"code"\s*:\s*"42501"'
  LOOP
    PERFORM public.redrive_ucat_preparation_refresh(v_student_id);
  END LOOP;
END;
$$;
