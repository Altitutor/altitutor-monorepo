-- DEV-491: live clients may read round state separately from station content.
-- Keep question intervals, phase history, presence and recording availability
-- authoritative. Station reconstruction is independently selectable below.
CREATE FUNCTION public.interview_round_live_json(r public.interview_rounds) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb; actor uuid:=public.interview_tutor_id((select auth.uid()));
BEGIN
 -- Composite arguments are untrusted; reload and repeat the caller guard.
 SELECT source.* INTO r FROM public.interview_rounds source WHERE source.id=r.id;
 IF r.id IS NULL OR r.data->>'deletedAt' IS NOT NULL OR
  (NOT coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role',false)
   AND NOT coalesce(actor=ANY(r.tutor_ids) OR actor=r.created_by,false)) THEN RETURN NULL; END IF;
 d:=public.interview_effective_state(r.data);
 RETURN (d-'stations') || jsonb_build_object('id',r.id,'version',r.version,'updatedAt',r.updated_at,'serverNow',now(),
  'connectedStudentIds',(SELECT coalesce(jsonb_agg(student_id),'[]') FROM public.interview_presence
    WHERE round_id=r.id AND last_seen_at>now()-interval '35 seconds'),
  'connectedTutorIds',(SELECT coalesce(jsonb_agg(tutor_id),'[]') FROM public.interview_tutor_presence
    WHERE round_id=r.id AND last_seen_at>now()-interval '35 seconds'),
  'recordings',(SELECT coalesce(jsonb_agg(public.interview_recording_json(rec) ORDER BY rec.created_at),'[]')
    FROM public.interview_recordings rec WHERE rec.round_id=r.id
    AND NOT (rec.id IS NOT DISTINCT FROM rec.capture_id AND EXISTS(
      SELECT 1 FROM public.interview_recordings child WHERE child.capture_id=rec.id AND child.id<>rec.id))));
END;
$$;
REVOKE ALL ON FUNCTION public.interview_round_live_json(public.interview_rounds) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_round_live_json(public.interview_rounds) TO authenticated,service_role;

CREATE VIEW public.vtutor_interview_live_rounds WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (
 SELECT public.interview_tutor_id((select auth.uid())) AS id
)
SELECT r.id, actor.id AS actor_id,
 md5(jsonb_build_object('stations',r.data->'stations','rubrics',(
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'version',q.version,
    'rubricVersion',q.rubric_version,'updatedAt',q.updated_at) ORDER BY s.ordinality,p.ordinality),'[]'::jsonb)
  FROM jsonb_array_elements(r.data->'stations') WITH ORDINALITY s
  CROSS JOIN LATERAL jsonb_array_elements(s.value->'questions') WITH ORDINALITY p
  LEFT JOIN public.interview_questions q ON q.id=(p.value->>'questionId')::uuid
 ))::text) AS content_revision,
 public.interview_round_live_json(r) AS data,
 public.interview_round_json(r)->'stations' AS stations
FROM public.interview_rounds r CROSS JOIN actor
WHERE actor.id IS NOT NULL
 AND (actor.id=ANY(r.tutor_ids) OR actor.id=r.created_by)
 AND r.data->>'deletedAt' IS NULL;
REVOKE ALL ON public.vtutor_interview_live_rounds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vtutor_interview_live_rounds TO authenticated,service_role;

-- The Student facade never exposes mutable Tutor question intervals or phase
-- history. Preserve its exact safe fields and frozen released results while
-- advancing only the visible clock; do not walk every station attempt per read.
DO $migration$
DECLARE definition text; previous text:='d:=public.interview_effective_state(r.data);';
BEGIN
 SELECT pg_get_functiondef('public.interview_student_round_json(public.interview_rounds,uuid)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 THEN
  RAISE EXCEPTION 'Unrecognized Student round clock projection';
 END IF;
 EXECUTE replace(definition,previous,'d:=r.data || public.interview_effective_phase_state(r.data);');
END;
$migration$;

-- Most reads see timing that a prior command already canonicalised. In that
-- case, avoid repeatedly copying the growing attempts array. Fall through to
-- the original implementation for every missing/changed/malformed interval.
DO $migration$
DECLARE definition text; previous text:=E'BEGIN\n FOR a IN SELECT';
BEGIN
 SELECT pg_get_functiondef('public.interview_question_timing(jsonb,timestamptz)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 THEN
  RAISE EXCEPTION 'Unrecognized interview question timing implementation';
 END IF;
 EXECUTE replace(definition,previous,$guard$BEGIN
 IF jsonb_typeof(d->'attempts')='array' AND jsonb_typeof(d->'stations')='array'
  AND jsonb_typeof(d->'progress')='array' AND NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(d->'attempts') candidate
   LEFT JOIN LATERAL (
    SELECT value FROM jsonb_array_elements(d->'progress')
    WHERE value->>'stationId'=candidate.value->>'stationId'
     AND value->>'studentId'=candidate.value->>'studentId' LIMIT 1
   ) participant ON true
   LEFT JOIN LATERAL (
    SELECT value FROM jsonb_array_elements(d->'stations')
    WHERE value->>'id'=candidate.value->>'stationId' LIMIT 1
   ) station_state ON true
   CROSS JOIN LATERAL (SELECT
    candidate.value->'questionIntervals'->-1 AS latest_interval,
    coalesce(candidate.value->>'selectedQuestionId',station_state.value->'questions'->0->>'id') AS selected_question,
    CASE WHEN d->>'phase'='questions' AND d->>'pausedAt' IS NULL AND participant.value IS NOT NULL
     THEN NOT coalesce((participant.value->>'endedEarly')::boolean,false)
      AND NOT coalesce((participant.value->>'feedbackComplete')::boolean,false)
     ELSE false END AS is_active
   ) timing
   WHERE jsonb_typeof(coalesce(candidate.value->'questionIntervals','[]'::jsonb)) IS DISTINCT FROM 'array'
    OR CASE WHEN timing.is_active AND timing.selected_question IS NOT NULL THEN
      timing.latest_interval IS NULL OR timing.latest_interval->>'endedAt' IS NOT NULL
      OR candidate.value->'selectedQuestionId' IS DISTINCT FROM to_jsonb(timing.selected_question)
     ELSE timing.latest_interval IS NOT NULL AND timing.latest_interval->>'endedAt' IS NULL END
  ) THEN RETURN d; END IF;
 FOR a IN SELECT$guard$);
END;
$migration$;
