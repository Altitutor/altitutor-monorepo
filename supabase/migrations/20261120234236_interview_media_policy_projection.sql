-- DEV-487: media tickets need fresh capability state, not assessment rendering.
-- Keep the full interview_media_state RPC for the Admin observer's content UI.
CREATE FUNCTION public.interview_media_policy_state(p_round_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object(
   'id',r.id,'version',r.version,'delivery',r.data->'delivery','mode',r.data->'mode',
   'recordingEnabled',r.data->'recordingEnabled','startedAt',r.data->'startedAt',
   'pausedAt',r.data->'pausedAt','serverNow',now(),
   'stationIds',(SELECT coalesce(jsonb_agg(station->'id'),'[]') FROM jsonb_array_elements(r.data->'stations') station),
   'progress',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'stationId',station->'stationId','tutorId',station->'tutorId','studentId',station->'studentId',
      'endedEarly',station->'endedEarly','feedbackComplete',station->'feedbackComplete')),'[]')
      FROM jsonb_array_elements(r.data->'progress') station),
   'attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',attempt->'id','stationId',attempt->'stationId','studentId',attempt->'studentId')),'[]')
      FROM jsonb_array_elements(r.data->'attempts') attempt),
   'tutors',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',person->'id','name',person->'name')),'[]')
      FROM jsonb_array_elements(r.data->'tutors') person),
   'students',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',person->'id','name',person->'name')),'[]')
      FROM jsonb_array_elements(r.data->'students') person),
   'recordings',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',recording.id,'kind',recording.kind,
      'state',CASE WHEN recording.expires_at<=now() THEN 'expired' ELSE recording.state END) ORDER BY recording.created_at),'[]')
      FROM public.interview_recordings recording WHERE recording.round_id=r.id
      AND NOT (recording.id IS NOT DISTINCT FROM recording.capture_id AND EXISTS(
         SELECT 1 FROM public.interview_recordings child WHERE child.capture_id=recording.id AND child.id<>recording.id)))
 ) || public.interview_effective_phase_state(r.data)
 FROM public.interview_rounds r WHERE r.id=p_round_id AND r.data->>'deletedAt' IS NULL;
$$;
REVOKE ALL ON FUNCTION public.interview_media_policy_state(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_media_policy_state(uuid) TO service_role;

-- These admission views retain the existing rich facade's actor/roster checks.
-- Actual phase permissions are freshly rechecked by the service around provider
-- awaits; this view is not a cached media permission or a token grant.
CREATE VIEW public.vtutor_interview_media_access WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (
 SELECT (SELECT public.interview_tutor_id((SELECT auth.uid()))) AS id,
        (SELECT public.current_tutor_id()) AS profile_id
)
SELECT r.id,r.data->>'delivery' AS delivery,actor.profile_id AS actor_id
FROM public.interview_rounds r CROSS JOIN actor
WHERE actor.id IS NOT NULL AND (actor.id=ANY(r.tutor_ids) OR actor.id=r.created_by)
  AND r.data->>'deletedAt' IS NULL;

CREATE VIEW public.vstudent_interview_media_access WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (
 SELECT (SELECT public.current_student_id()) AS id
), enrolled_actor AS MATERIALIZED (
 SELECT id FROM actor WHERE public.interview_student_has_access(id)
)
SELECT r.id,r.data->>'delivery' AS delivery,actor.id AS actor_id
FROM public.interview_rounds r CROSS JOIN enrolled_actor actor
WHERE actor.id=ANY(r.student_ids) AND r.data->>'deletedAt' IS NULL;
REVOKE ALL ON public.vtutor_interview_media_access,public.vstudent_interview_media_access FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vtutor_interview_media_access,public.vstudent_interview_media_access TO authenticated;
COMMENT ON FUNCTION public.interview_media_policy_state(uuid) IS 'Fresh service-only media capability and reconciliation state, without assessment/timing/rubric projections.';
COMMENT ON VIEW public.vtutor_interview_media_access IS 'Caller-scoped tutor media admission identity; phase permission is revalidated server-side.';
COMMENT ON VIEW public.vstudent_interview_media_access IS 'Caller-scoped enrolled student media admission identity; phase permission is revalidated server-side.';
