-- DEV-308: question navigation is timing evidence, not an assessment save.
-- Intervals live beside their immutable station attempt and enter result snapshots.
CREATE FUNCTION public.interview_question_timing(d jsonb, at_time timestamptz) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE a jsonb; p jsonb; s jsonb; intervals jsonb; latest jsonb; selected text;
 active boolean; ending timestamptz; opening timestamptz; result jsonb:='[]'; last_idx integer;
BEGIN
 FOR a IN SELECT value FROM jsonb_array_elements(coalesce(d->'attempts','[]')) LOOP
  SELECT value INTO p FROM jsonb_array_elements(d->'progress')
   WHERE value->>'stationId'=a->>'stationId' AND value->>'studentId'=a->>'studentId';
  SELECT value INTO s FROM jsonb_array_elements(d->'stations') WHERE value->>'id'=a->>'stationId';
  intervals:=coalesce(a->'questionIntervals','[]'); last_idx:=jsonb_array_length(intervals)-1;
  latest:=intervals->last_idx;
  active:=d->>'phase'='questions' AND d->>'pausedAt' IS NULL AND p IS NOT NULL
    AND NOT coalesce((p->>'endedEarly')::boolean,false) AND NOT coalesce((p->>'feedbackComplete')::boolean,false);
  selected:=coalesce(a->>'selectedQuestionId',s->'questions'->0->>'id');
  IF active AND selected IS NOT NULL THEN
   IF latest IS NULL OR latest->>'endedAt' IS NOT NULL THEN
    opening:=CASE WHEN last_idx<0 THEN (d->>'phaseStartedAt')::timestamptz ELSE greatest(at_time,(latest->>'endedAt')::timestamptz) END;
    intervals:=intervals || jsonb_build_array(jsonb_build_object('questionId',selected,'startedAt',opening,
      'endedAt',NULL,'deadlineAt',d->'phaseDeadline'));
   END IF;
   a:=a || jsonb_build_object('selectedQuestionId',selected,'questionIntervals',intervals);
  ELSIF latest IS NOT NULL AND latest->>'endedAt' IS NULL THEN
   ending:=least(at_time,coalesce((d->>'pausedAt')::timestamptz,at_time),coalesce((latest->>'deadlineAt')::timestamptz,at_time));
   intervals:=jsonb_set(intervals,ARRAY[last_idx::text,'endedAt'],to_jsonb(greatest(ending,(latest->>'startedAt')::timestamptz)));
   a:=a || jsonb_build_object('questionIntervals',intervals);
  END IF;
  result:=result || jsonb_build_array(a);
 END LOOP;
 RETURN jsonb_set(d,'{attempts}',result);
END;
$$;
REVOKE ALL ON FUNCTION public.interview_question_timing(jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_question_timing(jsonb,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.interview_effective_state(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE d jsonb:=p_data; deadline timestamptz;
BEGIN
 IF d->>'pausedAt' IS NOT NULL THEN RETURN public.interview_question_timing(d,(d->>'pausedAt')::timestamptz); END IF;
 deadline:=(d->>'phaseDeadline')::timestamptz;
 IF d->>'phase'='reading' AND deadline<=now() THEN
  d:=public.interview_close_phase(d,deadline) || jsonb_build_object('phase','questions','phaseStartedAt',deadline,
   'phaseDeadline',deadline+make_interval(secs=>(d->>'questionTimeSeconds')::integer));
  d:=public.interview_question_timing(d,deadline);
  deadline:=(d->>'phaseDeadline')::timestamptz;
 END IF;
 IF d->>'phase'='questions' AND deadline<=now() THEN
  d:=public.interview_question_timing(d,deadline);
  d:=public.interview_close_phase(d,deadline) || jsonb_build_object('phase','feedback','phaseStartedAt',deadline,'phaseDeadline',NULL);
  d:=public.interview_question_timing(d,deadline);
 END IF;
 RETURN public.interview_question_timing(d,now());
END;
$$;

-- Extend the current command in place, preserving all existing controls and
-- their NO KEY UPDATE lock (including independent heartbeat concurrency).
DO $migration$
DECLARE definition text; needle text;
BEGIN
 SELECT pg_get_functiondef('public.interview_command(uuid,jsonb)'::regprocedure) INTO definition;
 needle:='  ELSIF kind=''saveAttempt'' THEN';
 IF strpos(definition,needle)=0 OR strpos(definition,'kind=''selectQuestion''')<>0 THEN
  RAISE EXCEPTION 'Unrecognized interview command for question timing';
 END IF;
 definition:=replace(definition,'child_position integer;', 'child_position integer; timing_at timestamptz;');
 definition:=replace(definition,needle,$command$
  ELSIF kind='selectQuestion' THEN
   timing_at:=clock_timestamp();
   SELECT value,(ordinality-1)::integer INTO attempt,attempt_idx FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY
    WHERE value->>'id'=p_command->>'attemptId';
   IF attempt IS NULL OR attempt->>'stationId' IS DISTINCT FROM progress->>'stationId'
    OR attempt->>'studentId' IS DISTINCT FROM progress->>'studentId' THEN
    RAISE EXCEPTION 'Only the assigned tutor may select this question' USING ERRCODE='42501';
   END IF;
   IF d->>'phase'<>'questions' OR d->>'pausedAt' IS NOT NULL OR coalesce((progress->>'endedEarly')::boolean,false)
    OR coalesce((progress->>'feedbackComplete')::boolean,false) THEN
    RAISE EXCEPTION 'Questions are not active for this station' USING ERRCODE='22023';
   END IF;
   IF (d->>'phaseDeadline')::timestamptz<=timing_at THEN
    RAISE EXCEPTION 'Question time has ended' USING ERRCODE='22023';
   END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(station->'questions') AS navigation_question(value) WHERE navigation_question.value->>'id'=p_command->>'questionId') THEN
    RAISE EXCEPTION 'Question does not belong to this station' USING ERRCODE='22023';
   END IF;
   IF attempt->>'selectedQuestionId' IS DISTINCT FROM p_command->>'questionId' THEN
    item:=coalesce(attempt->'questionIntervals','[]');
    timing_at:=greatest(timing_at,(item->-1->>'startedAt')::timestamptz,(item->-1->>'endedAt')::timestamptz);
    IF jsonb_array_length(item)>=10000 THEN RAISE EXCEPTION 'Question navigation limit reached' USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(item)>0 AND item->-1->>'endedAt' IS NULL THEN
     item:=jsonb_set(item,ARRAY[(jsonb_array_length(item)-1)::text,'endedAt'],to_jsonb(timing_at));
    END IF;
    item:=item || jsonb_build_array(jsonb_build_object('questionId',p_command->>'questionId','startedAt',timing_at,'endedAt',NULL,'deadlineAt',d->'phaseDeadline'));
    d:=jsonb_set(d,ARRAY['attempts',attempt_idx::text],attempt || jsonb_build_object('selectedQuestionId',p_command->>'questionId','questionIntervals',item));
    changed:=true;
   END IF;
  ELSIF kind='saveAttempt' THEN$command$);
 definition:=replace(definition,'''heartbeat'',''tick'',''saveAttempt''','''heartbeat'',''tick'',''saveAttempt'',''selectQuestion''');
 definition:=replace(definition,'  IF changed THEN','  IF changed THEN'||chr(10)||'   d:=public.interview_question_timing(d,now());');
 definition:=replace(definition,'CASE WHEN kind=''saveAttempt'' AND','CASE WHEN kind IN (''saveAttempt'',''selectQuestion'') AND');
 -- Confirmed in-person claim corrections move timing with the assessment and recordings.
 definition:=replace(definition,'''score'',old_attempt->''score'',''notAssessedReason''',
  '''selectedQuestionId'',old_attempt->''selectedQuestionId'',''questionIntervals'',coalesce(old_attempt->''questionIntervals'',''[]''::jsonb),''score'',old_attempt->''score'',''notAssessedReason''');
 definition:=replace(definition,'old_attempt || jsonb_build_object(''score'',NULL',
  'old_attempt || jsonb_build_object(''selectedQuestionId'',NULL,''questionIntervals'',''[]''::jsonb,''score'',NULL');
 EXECUTE definition;
END;
$migration$;
