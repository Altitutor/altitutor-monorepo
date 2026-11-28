-- DEV-506: select the caller's input set before computing canonical evidence.
-- Keep lifecycle/deadline policy in its existing shared module. The Trial
-- directory retains every possible current-journey candidate for global facts.
CREATE FUNCTION public.onboarding_journeys_read(
  p_student_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_cohort text DEFAULT NULL,
  p_directory boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
DECLARE selected_ids uuid[];
BEGIN
  IF p_directory THEN
    IF p_student_id IS NOT NULL OR p_from IS NOT NULL OR p_to IS NOT NULL OR p_cohort IS NOT NULL THEN
      RAISE EXCEPTION 'Directory scope cannot be combined with another scope' USING ERRCODE='22023';
    END IF;
    -- The Students RPC chooses the open journey first, then newest creation
    -- time and UUID. isOpen also depends on canonical evidence, so retain every
    -- unclosed candidate plus the newest closed fallback, rather than deciding
    -- lifecycle here. Families remain separate entries.
    SELECT coalesce(array_agg(candidate.id), ARRAY[]::uuid[]) INTO selected_ids
    FROM (
      SELECT j.id,j.student_id,j.closed_at,
        row_number() OVER (PARTITION BY j.student_id,(j.closed_at IS NULL)
          ORDER BY j.created_at DESC,j.id) AS recency
      FROM public.onboarding_journeys j
      WHERE j.student_id IS NULL OR EXISTS (
        SELECT 1 FROM public.students s WHERE s.id=j.student_id AND s.deleted_at IS NULL
      )
    ) candidate
    WHERE candidate.student_id IS NULL OR candidate.closed_at IS NULL OR candidate.recency=1;
    RETURN public.onboarding_journeys_scoped(selected_ids);
  END IF;

  IF p_student_id IS NOT NULL THEN
    IF p_from IS NOT NULL OR p_to IS NOT NULL OR p_cohort IS NOT NULL THEN
      RAISE EXCEPTION 'Choose a Student or an enquiry cohort, not both' USING ERRCODE='22023';
    END IF;
  ELSIF p_from IS NULL OR p_to IS NULL OR p_from>p_to
    OR p_cohort IS NULL OR p_cohort NOT IN ('new','returning','historical') THEN
    RAISE EXCEPTION 'An enquiry cohort and valid date range are required' USING ERRCODE='22023';
  END IF;

  SELECT coalesce(array_agg(j.id), ARRAY[]::uuid[]) INTO selected_ids
  FROM public.onboarding_journeys j
  WHERE CASE WHEN p_student_id IS NOT NULL THEN j.student_id=p_student_id
    ELSE
      -- Unknown dates are counted separately in the Historical funnel, for
      -- all history, even when outside the selected enquiry-date interval.
      (p_cohort='historical' AND j.historical AND j.enquiry_at IS NULL)
      OR (
        (j.enquiry_at AT TIME ZONE 'Australia/Adelaide')::date BETWEEN p_from AND p_to
        AND CASE WHEN j.student_id IS NULL THEN
          -- Families contribute only to unresolved New enquiries. Their
          -- is_returning flag does not change that existing funnel rule.
          p_cohort='new' AND NOT j.historical
        ELSE
          CASE WHEN j.historical THEN 'historical'
            WHEN j.is_returning THEN 'returning' ELSE 'new' END = p_cohort
        END
      )
    END;

  RETURN public.onboarding_journeys_scoped(selected_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.onboarding_journeys_read(uuid,date,date,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.onboarding_journeys_read(uuid,date,date,text,boolean) TO authenticated,service_role;
COMMENT ON FUNCTION public.onboarding_journeys_read(uuid,date,date,text,boolean) IS
  'Caller-authorized Student/cohort journeys; compute existing canonical evidence only after selecting the requested input set.';
