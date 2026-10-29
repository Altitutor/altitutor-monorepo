-- DEV-230: additive calendar estimate; retain the student-safe projection and actor guards.
CREATE OR REPLACE FUNCTION public.interview_student_round_json(r public.interview_rounds,p_student_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb; progress jsonb; station jsonb; result jsonb; station_number integer; result_stations jsonb;
BEGIN
 SELECT source.* INTO r FROM public.interview_rounds source WHERE source.id=r.id;
 IF r.id IS NULL OR p_student_id IS DISTINCT FROM public.current_student_id() OR NOT public.interview_student_has_access(p_student_id)
  OR NOT(p_student_id=ANY(r.student_ids)) THEN RETURN NULL; END IF;
 d:=public.interview_effective_state(r.data);
 SELECT value INTO progress FROM jsonb_array_elements(d->'progress') WHERE value->>'studentId'=p_student_id::text;
 SELECT value,ordinality::integer INTO station,station_number FROM jsonb_array_elements(d->'stations') WITH ORDINALITY WHERE value->>'id'=progress->>'stationId';
 SELECT value INTO result FROM jsonb_array_elements(d->'releasedResults') WHERE value->>'studentId'=p_student_id::text;
 IF result IS NOT NULL THEN
  result:=result || jsonb_build_object('recordings',(SELECT coalesce(jsonb_agg(public.interview_recording_json(rec) ORDER BY rec.created_at),'[]')
   FROM public.interview_recordings rec WHERE rec.round_id=r.id
   AND (rec.id::text IN (SELECT value->>'id' FROM jsonb_array_elements(result->'recordings'))
     OR rec.capture_id::text IN (SELECT value->>'id' FROM jsonb_array_elements(result->'recordings')))
   AND NOT (rec.id IS NOT DISTINCT FROM rec.capture_id AND EXISTS(SELECT 1 FROM public.interview_recordings child WHERE child.capture_id=rec.id AND child.id<>rec.id))));
  SELECT jsonb_agg(jsonb_build_object('id',s.value->'id','name','','maximumPoints',s.value->'maximumPoints','prompt',coalesce(s.value->'prompt',s.value->'questions'->0->'prompt'),'questions',
   (SELECT jsonb_agg(p.value - 'rubric' - 'rubricVersion' || jsonb_build_object('rubric',NULL,'rubricVersion',0) ORDER BY p.ordinality)
    FROM jsonb_array_elements(s.value->'questions') WITH ORDINALITY p)) ORDER BY s.ordinality)
  INTO result_stations FROM jsonb_array_elements(d->'stations') WITH ORDINALITY s;
 END IF;
 RETURN jsonb_build_object('id',r.id,'version',r.version,'name',d->'name','delivery',d->'delivery','mode',d->'mode','recordingEnabled',d->'recordingEnabled',
  'scheduledAt',d->'scheduledAt',
  'scheduledEndAt',CASE WHEN d->>'scheduledAt' IS NULL THEN NULL ELSE (d->>'scheduledAt')::timestamptz +
    make_interval(secs => greatest(1800, ((d->>'readingTimeSeconds')::integer + (d->>'questionTimeSeconds')::integer) * greatest(1,jsonb_array_length(d->'stations')))) END,
  'startedAt',d->'startedAt','phase',d->'phase','rotation',d->'rotation','pausedAt',d->'pausedAt',
  'phaseStartedAt',d->'phaseStartedAt','phaseDeadline',CASE WHEN d->>'phase'='reading' THEN d->'phaseDeadline' ELSE 'null'::jsonb END,'serverNow',now(),
  'studentId',p_student_id,'stationId',progress->'stationId','stationNumber',station_number,
  'tutor',(SELECT value FROM jsonb_array_elements(d->'tutors') WHERE value->>'id'=progress->>'tutorId'),
  'prompt',CASE WHEN d->>'phase' IN ('reading','questions','feedback') THEN coalesce(station->'prompt',station->'questions'->0->'prompt') ELSE 'null'::jsonb END,
  'endedEarly',coalesce(progress->'endedEarly','false'),
  'stations',(SELECT jsonb_agg(jsonb_build_object('id',s.value->'id','number',s.ordinality,'complete',EXISTS(
     SELECT 1 FROM jsonb_array_elements(d->'attempts') a WHERE a->>'studentId'=p_student_id::text AND a->>'stationId'=s.value->>'id' AND (a->>'completed')::boolean)) ORDER BY s.ordinality)
     FROM jsonb_array_elements(d->'stations') WITH ORDINALITY s), 'result',result,'resultStations',coalesce(result_stations,'[]'));
END;
$$;

