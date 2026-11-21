-- Ordinary directory pages need evidence only for their visible journeys.
-- Keep the legacy whole-board RPC and canonical evidence computation intact.
CREATE FUNCTION public.onboarding_journeys_scoped(p_journey_ids uuid[])
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(
    to_jsonb(j) || jsonb_build_object(
      'preferences', coalesce((
        SELECT jsonb_agg(to_jsonb(p))
        FROM public.onboarding_action_preferences p
        WHERE p.journey_id = j.id
      ), '[]'::jsonb),
      'evidence', CASE
        WHEN j.closed_evidence IS NOT NULL THEN j.closed_evidence
        ELSE public.onboarding_evidence(j.id)
      END
    ) ORDER BY j.created_at DESC, j.id
  ), '[]'::jsonb)
  FROM public.onboarding_journeys j
  WHERE j.id = ANY(coalesce(p_journey_ids, ARRAY[]::uuid[]));
$$;
REVOKE ALL ON FUNCTION public.onboarding_journeys_scoped(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_journeys_scoped(uuid[]) TO authenticated, service_role;
COMMENT ON FUNCTION public.onboarding_journeys_scoped(uuid[]) IS 'Caller-authorized evidence and closure snapshots for explicitly selected directory journeys; no cached classification.';
