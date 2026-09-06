-- Give billing workers one round trip for the canonical chargeability decision.
-- This keeps scheduled billing aligned with billing-single and adjustment flows,
-- including planned and actual trial attendance exclusions.

CREATE OR REPLACE FUNCTION public.get_chargeable_sessions_students_ids(
  p_sessions_students_ids uuid[]
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(requested.sessions_students_id ORDER BY requested.sessions_students_id),
    ARRAY[]::uuid[]
  )
  FROM unnest(COALESCE(p_sessions_students_ids, ARRAY[]::uuid[]))
    AS requested(sessions_students_id)
  WHERE public.session_student_is_chargeable(requested.sessions_students_id);
$$;

REVOKE ALL ON FUNCTION public.get_chargeable_sessions_students_ids(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chargeable_sessions_students_ids(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_chargeable_sessions_students_ids(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_chargeable_sessions_students_ids(uuid[]) TO service_role;

COMMENT ON FUNCTION public.get_chargeable_sessions_students_ids(uuid[]) IS
  'Returns the requested session-student assignment IDs whose canonical billing obligation currently requires a charge.';
