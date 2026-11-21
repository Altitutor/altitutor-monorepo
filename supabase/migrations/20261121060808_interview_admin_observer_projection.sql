-- DEV-488: keep the Admin observer's two-second authoritative reads, but build
-- only live progress and the selected station's content when it changes.
CREATE FUNCTION public.interview_observer_text(p_value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result text;
BEGIN
 IF jsonb_typeof(p_value)='string' THEN RETURN p_value #>> '{}'; END IF;
 IF jsonb_typeof(p_value)='array' THEN
  SELECT string_agg(public.interview_observer_text(value),' ' ORDER BY ordinality)
  INTO result FROM jsonb_array_elements(p_value) WITH ORDINALITY;
  RETURN coalesce(result,'');
 END IF;
 IF jsonb_typeof(p_value)='object' THEN
  IF jsonb_typeof(p_value->'text')='string' THEN RETURN p_value->>'text'; END IF;
  RETURN public.interview_observer_text(p_value->'content');
 END IF;
 RETURN '';
END;
$$;
REVOKE ALL ON FUNCTION public.interview_observer_text(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_observer_text(jsonb) TO service_role;

CREATE FUNCTION public.interview_observer_state(
 p_round_id uuid,p_station_id uuid DEFAULT NULL,p_content_revision text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.interview_rounds; live jsonb; station jsonb; attempt jsonb;
 revision text; rubric_revisions jsonb; content jsonb;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id AND data->>'deletedAt' IS NULL;
 IF r.id IS NULL THEN RETURN NULL; END IF;
 live:=jsonb_build_object(
  'id',r.id,'version',r.version,'name',r.data->'name','delivery',r.data->'delivery','mode',r.data->'mode',
  'recordingEnabled',r.data->'recordingEnabled','scheduledAt',r.data->'scheduledAt','startedAt',r.data->'startedAt',
  'rotation',r.data->'rotation','pausedAt',r.data->'pausedAt','remainingMilliseconds',r.data->'remainingMilliseconds',
  'readingTimeSeconds',r.data->'readingTimeSeconds','questionTimeSeconds',r.data->'questionTimeSeconds',
  'students',r.data->'students','tutors',r.data->'tutors',
  'stations',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.value->'id','name',s.value->'name',
    'maximumPoints',s.value->'maximumPoints','questionCount',jsonb_array_length(coalesce(s.value->'questions','[]'::jsonb)))
    ORDER BY s.ordinality),'[]'::jsonb) FROM jsonb_array_elements(r.data->'stations') WITH ORDINALITY s),
  'progress',(SELECT coalesce(jsonb_agg(p.value || jsonb_build_object('answeredQuestionCount',(
    SELECT count(*) FROM jsonb_array_elements(coalesce(s.value->'questions','[]'::jsonb)) question
    WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(a.value->'feedback','[]'::jsonb)) feedback
      WHERE feedback->>'placementId'=question->>'id'
      -- Match interviewText(...).trim(): empty rich documents are unanswered.
      AND btrim(public.interview_observer_text(feedback->'value'),
        U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')<>'')))
    ORDER BY p.ordinality),'[]'::jsonb)
    FROM jsonb_array_elements(r.data->'progress') WITH ORDINALITY p
    LEFT JOIN LATERAL (SELECT value FROM jsonb_array_elements(r.data->'stations') WHERE value->>'id'=p.value->>'stationId' LIMIT 1) s ON true
    LEFT JOIN LATERAL (SELECT value FROM jsonb_array_elements(r.data->'attempts') WHERE value->>'stationId'=p.value->>'stationId'
      AND value->>'studentId'=p.value->>'studentId' LIMIT 1) a ON true),
  'connectedStudentIds',(SELECT coalesce(jsonb_agg(student_id),'[]'::jsonb) FROM public.interview_presence
    WHERE round_id=r.id AND last_seen_at>now()-interval '35 seconds'),
  'connectedTutorIds',(SELECT coalesce(jsonb_agg(tutor_id),'[]'::jsonb) FROM public.interview_tutor_presence
    WHERE round_id=r.id AND last_seen_at>now()-interval '35 seconds'),
  'recordings',(SELECT coalesce(jsonb_agg(public.interview_recording_json(rec) ORDER BY rec.created_at),'[]'::jsonb)
    FROM public.interview_recordings rec WHERE rec.round_id=r.id
    AND NOT (rec.id IS NOT DISTINCT FROM rec.capture_id AND EXISTS(
      SELECT 1 FROM public.interview_recordings child WHERE child.capture_id=rec.id AND child.id<>rec.id))),
  'serverNow',now()
 ) || public.interview_effective_phase_state(r.data);

 IF p_station_id IS NOT NULL THEN
  SELECT value INTO station FROM jsonb_array_elements(r.data->'stations') WHERE value->>'id'=p_station_id::text;
  IF station IS NOT NULL THEN
   SELECT jsonb_build_object('id',a.value->'id','stationId',a.value->'stationId','studentId',a.value->'studentId',
    'score',a.value->'score','notAssessedReason',a.value->'notAssessedReason','generalFeedback',a.value->'generalFeedback',
    'feedback',a.value->'feedback') INTO attempt
   FROM jsonb_array_elements(r.data->'attempts') a
   WHERE a.value->>'stationId'=p_station_id::text AND a.value->>'studentId'=(
    SELECT value->>'studentId' FROM jsonb_array_elements(r.data->'progress') WHERE value->>'stationId'=p_station_id::text LIMIT 1)
   LIMIT 1;
   -- Frozen prompt/question wording stays in the round. Bank rubric revisions
   -- remain live even for completed rounds; they need not bump round.version.
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.value->'questionId','version',q.version,
     'rubricVersion',q.rubric_version,'updatedAt',q.updated_at) ORDER BY p.ordinality),'[]'::jsonb)
   INTO rubric_revisions FROM jsonb_array_elements(station->'questions') WITH ORDINALITY p
   LEFT JOIN public.interview_questions q ON q.id=(p.value->>'questionId')::uuid;
   revision:=md5(jsonb_build_object('station',station,'attempt',attempt,'rubrics',rubric_revisions)::text);
   IF revision IS DISTINCT FROM p_content_revision THEN
    station:=station || jsonb_build_object('prompt',coalesce(station->'prompt',station->'questions'->0->'prompt'),
      'questions',(SELECT coalesce(jsonb_agg(p.value || jsonb_build_object(
        'rubric',coalesce(q.rubric,p.value->'rubric'),'rubricVersion',coalesce(to_jsonb(q.rubric_version),p.value->'rubricVersion'))
        ORDER BY p.ordinality),'[]'::jsonb)
       FROM jsonb_array_elements(station->'questions') WITH ORDINALITY p
       LEFT JOIN public.interview_questions q ON q.id=(p.value->>'questionId')::uuid));
    content:=jsonb_build_object('station',station,'attempt',attempt);
   END IF;
  END IF;
 END IF;
 RETURN jsonb_build_object('id',r.id,'round',live,'selectedStationId',p_station_id,
   'contentRevision',revision,'content',content);
END;
$$;
REVOKE ALL ON FUNCTION public.interview_observer_state(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_observer_state(uuid,uuid,text) TO service_role;
COMMENT ON FUNCTION public.interview_observer_state(uuid,uuid,text) IS 'Service-only Admin observer progress; selected content uses a rubric-aware revision, with no rich all-round projection.';
