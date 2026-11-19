-- DEV-468: retain command receipts, row locks and media/timing fixes from earlier migrations.
DO $migration$
DECLARE definition text; previous text;
BEGIN
 SELECT pg_get_functiondef('public.interview_command(uuid,jsonb)'::regprocedure) INTO definition;
 previous := 'child_position integer;';
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview declarations'; END IF;
 definition:=replace(definition,previous,previous || ' correction_source uuid; correction_target uuid; correction_station uuid;');
 previous := 'IF r.id IS NULL THEN RAISE EXCEPTION ''Round not found''';
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview round lookup'; END IF;
 definition:=replace(definition,previous,'IF r.id IS NULL OR r.data->>''deletedAt'' IS NOT NULL THEN RAISE EXCEPTION ''Round not found''');
 previous := '''heartbeat'',''tick'',''updateRound'',''start''';
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview creator guard'; END IF;
 definition:=replace(definition,previous,'''heartbeat'',''tick'',''updateRound'',''start'',''deleteRound'',''replaceStudent''');
 previous := $old$  ELSIF kind='start' THEN$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview controls'; END IF;
 definition:=replace(definition,previous,$new$
  ELSIF kind='deleteRound' THEN
   IF d->>'startedAt' IS NOT NULL THEN RAISE EXCEPTION 'Only unstarted rounds can be deleted' USING ERRCODE='22023'; END IF;
   -- Retain the operational record and its command audit; remove portal access.
   d:=d || jsonb_build_object('deletedAt',now(),'deletedBy',actor); changed:=true;
  ELSIF kind IN ('replaceStudent','swapStationStudents') THEN
   IF d->>'phase' IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Only completed rounds can be reassigned' USING ERRCODE='22023'; END IF;
   correction_source:=(p_command->>'studentId')::uuid;
   correction_target:=(p_command->>'targetStudentId')::uuid;
   correction_station:=(p_command->>'stationId')::uuid;
   IF correction_source IS NULL OR correction_target IS NULL OR correction_source=correction_target
    OR NOT(correction_source=ANY(r.student_ids)) THEN RAISE EXCEPTION 'Select two different students' USING ERRCODE='22023'; END IF;
   IF kind='replaceStudent' THEN
    IF correction_target=ANY(r.student_ids) OR NOT public.interview_student_has_access(correction_target) THEN
     RAISE EXCEPTION 'Select an eligible student outside this round' USING ERRCODE='22023'; END IF;
    SELECT array_agg(CASE WHEN s=correction_source THEN correction_target ELSE s END ORDER BY ord)
     INTO r.student_ids FROM unnest(r.student_ids) WITH ORDINALITY members(s,ord);
    d:=jsonb_set(d,'{studentIds}',to_jsonb(r.student_ids));
    SELECT jsonb_agg(CASE WHEN s->>'id'=correction_source::text THEN
      jsonb_build_object('id',correction_target,'name',(SELECT concat_ws(' ',first_name,last_name) FROM public.students WHERE id=correction_target)) ELSE s END ORDER BY ord)
     INTO item FROM jsonb_array_elements(d->'students') WITH ORDINALITY members(s,ord);
    d:=jsonb_set(d,'{students}',item);
    SELECT jsonb_agg(CASE WHEN p->>'studentId'=correction_source::text THEN p || jsonb_build_object('studentId',correction_target) ELSE p END ORDER BY ord)
     INTO item FROM jsonb_array_elements(d->'progress') WITH ORDINALITY members(p,ord);
    d:=jsonb_set(d,'{progress}',item);
   ELSE
    IF correction_station IS NULL OR correction_station::text IS DISTINCT FROM progress->>'stationId' THEN
     RAISE EXCEPTION 'Only the assigned tutor may reassign this station' USING ERRCODE='42501'; END IF;
    IF NOT(correction_target=ANY(r.student_ids)) THEN RAISE EXCEPTION 'Select a student in this round' USING ERRCODE='22023'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(d->'attempts') a
      WHERE a->>'stationId'=correction_station::text AND a->>'studentId' IN (correction_source::text,correction_target::text))<>2 THEN
     RAISE EXCEPTION 'Both station encounters are required for a swap' USING ERRCODE='22023'; END IF;
   END IF;
   -- The attempt identity is the encounter: timing and linked recordings follow it.
   -- Increment attempt versions so another tab cannot save an old student's draft.
   SELECT jsonb_agg(CASE WHEN (kind='replaceStudent' OR a->>'stationId'=correction_station::text)
     AND a->>'studentId' IN (correction_source::text,correction_target::text) THEN
      a || jsonb_build_object('studentId',CASE WHEN a->>'studentId'=correction_source::text THEN correction_target ELSE correction_source END,
       'version',(a->>'version')::integer+1,'updatedAt',now(),'updatedBy',actor)
     ELSE a END ORDER BY ord)
    INTO item FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY members(a,ord);
   d:=jsonb_set(d,'{attempts}',item);
   SELECT coalesce(jsonb_agg(a ORDER BY ord),'[]'::jsonb) INTO item
    FROM jsonb_array_elements(d->'releasedResults') WITH ORDINALITY members(a,ord)
    WHERE a->>'studentId' NOT IN (correction_source::text,correction_target::text);
   d:=jsonb_set(d,'{releasedResults}',item);
   d:=jsonb_set(d,'{withdrawnResultRevisions}',coalesce(d->'withdrawnResultRevisions','{}'::jsonb) || jsonb_build_object(
    correction_source::text,(SELECT coalesce(max(h.revision),0) FROM public.interview_result_releases h WHERE h.round_id=r.id AND h.student_id=correction_source),
    correction_target::text,(SELECT coalesce(max(h.revision),0) FROM public.interview_result_releases h WHERE h.round_id=r.id AND h.student_id=correction_target)));
   d:=jsonb_set(d,'{attributionCorrections}',coalesce(d->'attributionCorrections','[]'::jsonb) || jsonb_build_array(
    jsonb_build_object('type',kind,'studentId',correction_source,'targetStudentId',correction_target,
     'stationId',correction_station,'actorId',actor,'correctedAt',now()))); changed:=true;
  ELSIF kind='start' THEN$new$);
 previous := $old$    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'feedback') f WHERE NOT EXISTS$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized assessment validation'; END IF;
 definition:=replace(definition,previous,$new$    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'feedback') f WHERE f ? 'score' AND f->'score'<>'null'::jsonb AND
      CASE WHEN jsonb_typeof(f->'score')='number' THEN (f->>'score')::numeric NOT BETWEEN 0 AND (station->>'maximumPoints')::numeric ELSE true END)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'feedback') f WHERE NOT EXISTS$new$);
 previous := $old$coalesce((SELECT (value->>'revision')::integer FROM jsonb_array_elements(d->'releasedResults') WHERE value->>'studentId'=student_id::text),0)+1$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized release revision'; END IF;
 definition:=replace(definition,previous,$new$coalesce((SELECT max(history.revision) FROM public.interview_result_releases history WHERE history.round_id=r.id AND history.student_id=release_members.student_id),0)+1$new$);
 definition:=replace(definition,'FROM unnest(r.student_ids) student_id;', 'FROM unnest(r.student_ids) release_members(student_id);');
 previous := $old$ ELSIF kind='saveInterview' THEN$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview rubric invalidation'; END IF;
 definition:=replace(definition,previous,$new$
  PERFORM realtime.send(jsonb_build_object('id',live.id),'changed','interview-round:'||live.id,true)
   FROM public.interview_rounds live WHERE live.data->>'deletedAt' IS NULL AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(live.data->'stations') s
     WHERE s->>'stationId'=coalesce(p_command->'station'->>'id',p_command->>'stationId'));
 ELSIF kind='saveInterview' THEN$new$);
 EXECUTE definition;
END;
$migration$;

-- Tutor marking guidance is always current, even when reviewing a completed mock.
-- Student releases still use their frozen station wording/rubrics.
DO $migration$
DECLARE definition text; previous text; view_name text; view_definition text;
BEGIN
 SELECT pg_get_functiondef('public.interview_round_json(public.interview_rounds)'::regprocedure) INTO definition;
 previous := $old$ IF d->>'phase'='completed' THEN stations:=d->'stations'; ELSE$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized completed rubric projection'; END IF;
 definition:=replace(definition,previous,'');
 previous := $old$ END IF;
 SELECT coalesce(jsonb_agg(s.value$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized rubric projection end'; END IF;
 definition:=replace(definition,previous,$new$ SELECT coalesce(jsonb_agg(s.value$new$);
 definition:=replace(definition,'IF r.id IS NULL OR (','IF r.id IS NULL OR r.data->>''deletedAt'' IS NOT NULL OR (');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.interview_student_round_json(public.interview_rounds,uuid)'::regprocedure) INTO definition;
 previous := 'IF r.id IS NULL OR p_student_id';
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized student round projection'; END IF;
 EXECUTE replace(definition,previous,'IF r.id IS NULL OR r.data->>''deletedAt'' IS NOT NULL OR p_student_id');
 FOREACH view_name IN ARRAY ARRAY['vtutor_interview_rounds','vstudent_interview_rounds'] LOOP
  SELECT pg_get_viewdef(('public.' || view_name)::regclass,true) INTO view_definition;
  EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_invoker=false) AS SELECT visible.* FROM (%s) visible WHERE EXISTS (SELECT 1 FROM public.interview_rounds retained WHERE retained.id=visible.id AND retained.data->>''deletedAt'' IS NULL)',view_name,rtrim(view_definition,E';\n '));
 END LOOP;
 -- A withdrawn release is audit history, never a source for a new review.
 SELECT pg_get_functiondef('public.interview_review_mock_history(uuid,date)'::regprocedure) INTO definition;
 previous := 'WHERE round_id = r.id AND student_id = e.id ORDER BY revision DESC LIMIT 1';
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized performance review evidence'; END IF;
 EXECUTE replace(definition,previous,$new$WHERE round_id = r.id AND student_id = e.id
       AND revision > coalesce((r.data->'withdrawnResultRevisions'->>e.id::text)::integer,0)
       ORDER BY revision DESC LIMIT 1$new$);
END;
$migration$;

-- Deleted waiting rooms no longer admit private realtime subscribers.
DO $migration$
DECLARE definition text; previous text := 'WHERE r.id=p_round_id AND';
BEGIN
 SELECT pg_get_functiondef('public.interview_can_receive_round(uuid)'::regprocedure) INTO definition;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview realtime authorization'; END IF;
 EXECUTE replace(definition,previous, 'WHERE r.id=p_round_id AND r.data->>''deletedAt'' IS NULL AND');
END;
$migration$;
