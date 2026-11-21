-- DEV-487: list/calendar reads need setup, roster and availability, not live
-- assessment, rubric, question-timing, presence or recording projections.
CREATE FUNCTION public.interview_effective_phase_state(d jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE
 state jsonb:=jsonb_build_object('phase',d->'phase','phaseStartedAt',d->'phaseStartedAt','phaseDeadline',d->'phaseDeadline');
 deadline timestamptz;
BEGIN
 -- Match interview_effective_state's clock rules without rebuilding attempts
 -- or closing phase history. A paused deadline must never advance.
 IF d->>'pausedAt' IS NOT NULL THEN RETURN state; END IF;
 deadline:=(d->>'phaseDeadline')::timestamptz;
 IF state->>'phase'='reading' AND deadline<=now() THEN
  state:=jsonb_build_object('phase','questions','phaseStartedAt',deadline,
   'phaseDeadline',deadline+make_interval(secs=>(d->>'questionTimeSeconds')::integer));
  deadline:=(state->>'phaseDeadline')::timestamptz;
 END IF;
 IF state->>'phase'='questions' AND deadline<=now() THEN
  state:=jsonb_build_object('phase','feedback','phaseStartedAt',deadline,'phaseDeadline',NULL);
 END IF;
 RETURN state;
END;
$$;
REVOKE ALL ON FUNCTION public.interview_effective_phase_state(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_effective_phase_state(jsonb) TO authenticated,service_role;

-- These definer views are the caller read boundary: Tutor/Student roles have
-- no base-table reads. Keep the same roster/creator/enrolment scope as detail.
CREATE VIEW public.vtutor_interview_round_summaries WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (SELECT public.interview_tutor_id((select auth.uid())) AS id)
SELECT r.id,jsonb_build_object(
 'id',r.id,'version',r.version,'createdBy',r.created_by,'createdAt',r.data->'createdAt','updatedAt',r.updated_at,
 'interviewId',r.data->'interviewId','name',r.data->'name','delivery',r.data->'delivery','mode',r.data->'mode',
 'recordingEnabled',r.data->'recordingEnabled','scheduledAt',r.data->'scheduledAt',
 'rotationAllowanceSeconds',r.data->'rotationAllowanceSeconds',
 'studentIds',r.data->'studentIds','assignments',r.data->'assignments',
 'students',r.data->'students','tutors',r.data->'tutors',
 'startedAt',r.data->'startedAt','phase',public.interview_effective_phase_state(r.data)->'phase',
 'readingTimeSeconds',r.data->'readingTimeSeconds','questionTimeSeconds',r.data->'questionTimeSeconds',
 'stationCount',jsonb_array_length(coalesce(r.data->'stations','[]'::jsonb)),
 'releasedResultCount',jsonb_array_length(coalesce(r.data->'releasedResults','[]'::jsonb))
) AS data
FROM public.interview_rounds r CROSS JOIN actor
WHERE (actor.id=ANY(r.tutor_ids) OR actor.id=r.created_by)
 AND r.data->>'deletedAt' IS NULL;

CREATE VIEW public.vstudent_interview_round_summaries WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (SELECT public.current_student_id() AS id)
SELECT r.id,jsonb_build_object(
 'id',r.id,'version',r.version,'name',r.data->'name','delivery',r.data->'delivery','mode',r.data->'mode',
 'recordingEnabled',r.data->'recordingEnabled','scheduledAt',r.data->'scheduledAt',
 'scheduledEndAt',CASE WHEN r.data->>'scheduledAt' IS NULL THEN NULL ELSE (r.data->>'scheduledAt')::timestamptz+
  make_interval(secs=>((r.data->>'readingTimeSeconds')::integer+(r.data->>'questionTimeSeconds')::integer+
   coalesce((r.data->>'rotationAllowanceSeconds')::integer,0))*greatest(1,jsonb_array_length(r.data->'stations'))) END,
 'startedAt',r.data->'startedAt','phase',public.interview_effective_phase_state(r.data)->'phase',
 'stationCount',jsonb_array_length(coalesce(r.data->'stations','[]'::jsonb)),
 'hasReleasedResults',EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(r.data->'releasedResults','[]'::jsonb)) released
  WHERE released->>'studentId'=actor.id::text)
) AS data
FROM public.interview_rounds r CROSS JOIN actor
WHERE actor.id=ANY(r.student_ids) AND public.interview_student_has_access(actor.id)
 AND r.data->>'deletedAt' IS NULL;

REVOKE ALL ON public.vtutor_interview_round_summaries,public.vstudent_interview_round_summaries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vtutor_interview_round_summaries,public.vstudent_interview_round_summaries TO authenticated,service_role;
