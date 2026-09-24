-- Batch the data needed by the ADMINSTAFF staff-progression table into one
-- PostgREST round trip. Detailed check-in histories remain on the per-staff API.

CREATE OR REPLACE FUNCTION public.get_staff_pay_tier_summary_data(p_staff_ids UUID[])
RETURNS TABLE (
  staff_id UUID,
  metrics JSONB,
  last_check_in_session_id UUID,
  last_check_in_start_at TIMESTAMPTZ,
  last_check_in_long_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH requested_staff AS (
    SELECT DISTINCT requested.requested_staff_id AS staff_id
    FROM unnest(COALESCE(p_staff_ids, ARRAY[]::UUID[])) AS requested(requested_staff_id)
    INNER JOIN public.staff target_staff ON target_staff.id = requested.requested_staff_id
  ),
  check_in_candidates AS (
    SELECT
      booked_staff.staff_id,
      booked_session.id AS session_id,
      booked_session.start_at,
      booked_session.long_name
    FROM requested_staff requested
    INNER JOIN public.sessions_staff booked_staff ON booked_staff.staff_id = requested.staff_id
    INNER JOIN public.sessions booked_session ON booked_session.id = booked_staff.session_id
    WHERE booked_session.type = 'CHECK_IN'::public.session_type
      AND booked_staff.type IN (
        'CHECK_IN_RECEIVER',
        'MAIN_TUTOR'
      )
      AND booked_session.start_at IS NOT NULL

    UNION ALL

    SELECT
      logged_staff.staff_id,
      logged_session.id AS session_id,
      logged_session.start_at,
      logged_session.long_name
    FROM requested_staff requested
    INNER JOIN public.tutor_logs_staff_attendance logged_staff
      ON logged_staff.staff_id = requested.staff_id
      AND logged_staff.attended = TRUE
    INNER JOIN public.tutor_logs tutor_log ON tutor_log.id = logged_staff.tutor_log_id
    INNER JOIN public.sessions logged_session ON logged_session.id = tutor_log.session_id
    WHERE tutor_log.session_type = 'CHECK_IN'::public.session_type
      AND logged_staff.type IN (
        'CHECK_IN_RECEIVER',
        'MAIN_TUTOR'
      )
      AND logged_session.start_at IS NOT NULL
  ),
  last_check_ins AS (
    SELECT DISTINCT ON (candidate.staff_id)
      candidate.staff_id,
      candidate.session_id,
      candidate.start_at,
      candidate.long_name
    FROM check_in_candidates candidate
    ORDER BY candidate.staff_id, candidate.start_at DESC, candidate.session_id
  )
  SELECT
    requested.staff_id,
    public.compute_staff_tier_metrics(requested.staff_id) AS metrics,
    last_check_in.session_id AS last_check_in_session_id,
    last_check_in.start_at AS last_check_in_start_at,
    last_check_in.long_name AS last_check_in_long_name
  FROM requested_staff requested
  LEFT JOIN last_check_ins last_check_in ON last_check_in.staff_id = requested.staff_id;
END;
$$;

COMMENT ON FUNCTION public.get_staff_pay_tier_summary_data(UUID[]) IS
  'Returns pay-tier metrics and the latest booked or logged check-in for each requested staff member in one service-role-only call.';

REVOKE ALL ON FUNCTION public.get_staff_pay_tier_summary_data(UUID[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_staff_pay_tier_summary_data(UUID[])
  TO service_role;
