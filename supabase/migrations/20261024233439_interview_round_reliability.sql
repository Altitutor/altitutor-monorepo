-- DEV-233: explicit idle readiness, resolved missed encounters and lightweight presence.
-- A missed encounter is terminal only after an explicit not-assessed reason.
CREATE FUNCTION public.interview_attempt_resolved(attempt jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce((attempt->>'completed')::boolean,false) OR nullif(btrim(attempt->>'notAssessedReason'),'') IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.interview_attempt_resolved(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_attempt_resolved(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.interview_round_json(r public.interview_rounds) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d jsonb; stations jsonb;
BEGIN
 -- The composite argument is untrusted when invoked directly. Always reload it
 -- and enforce the same actor scope as the facade before projecting any data.
 SELECT source.* INTO r FROM public.interview_rounds source WHERE source.id=r.id;
 IF r.id IS NULL OR (NOT coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role',false)
  AND NOT coalesce(public.interview_tutor_id((select auth.uid()))=ANY(r.tutor_ids) OR public.interview_tutor_id((select auth.uid()))=r.created_by,false)) THEN RETURN NULL; END IF;
 d:=public.interview_effective_state(r.data);
 IF d->>'phase'='completed' THEN stations:=d->'stations'; ELSE
 SELECT coalesce(jsonb_agg(s.value || jsonb_build_object('questions',
   (SELECT coalesce(jsonb_agg(p.value || jsonb_build_object('rubric',coalesce(q.rubric,p.value->'rubric'),'rubricVersion',coalesce(to_jsonb(q.rubric_version),p.value->'rubricVersion')) ORDER BY p.ordinality),'[]')
    FROM jsonb_array_elements(s.value->'questions') WITH ORDINALITY p
    LEFT JOIN public.interview_questions q ON q.id=(p.value->>'questionId')::uuid)) ORDER BY s.ordinality),'[]')
 INTO stations FROM jsonb_array_elements(d->'stations') WITH ORDINALITY s;
 END IF;
 SELECT coalesce(jsonb_agg(s.value || jsonb_build_object('prompt',coalesce(s.value->'prompt',s.value->'questions'->0->'prompt')) ORDER BY s.ordinality),'[]') INTO stations FROM jsonb_array_elements(stations) WITH ORDINALITY s;
 RETURN d || jsonb_build_object('id',r.id,'version',r.version,'updatedAt',r.updated_at,'stations',stations,'serverNow',now(),
  'connectedStudentIds',(SELECT coalesce(jsonb_agg(student_id),'[]') FROM public.interview_presence
    WHERE round_id=r.id AND last_seen_at > now()-interval '35 seconds'),
  'connectedTutorIds',(SELECT coalesce(jsonb_agg(tutor_id),'[]') FROM public.interview_tutor_presence
    WHERE round_id=r.id AND last_seen_at > now()-interval '35 seconds'),
  'recordings',(SELECT coalesce(jsonb_agg(public.interview_recording_json(rec) ORDER BY rec.created_at),'[]') FROM public.interview_recordings rec WHERE rec.round_id=r.id AND NOT (rec.id IS NOT DISTINCT FROM rec.capture_id AND EXISTS(SELECT 1 FROM public.interview_recordings child WHERE child.capture_id=rec.id AND child.id<>rec.id))));
END;
$$;

CREATE OR REPLACE FUNCTION public.interview_command(p_actor_user_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 kind text:=p_command->>'type'; actor uuid:=public.interview_tutor_id(p_actor_user_id); student uuid;
 v_command_id uuid:=(p_command->>'commandId')::uuid; receipt public.interview_command_receipts;
 entity_id uuid; expected integer:=(p_command->>'expectedVersion')::integer; q public.interview_questions; t public.interviews; r public.interview_rounds;
 d jsonb; item jsonb; progress jsonb; station jsonb; attempt jsonb; target_attempt jsonb; old_attempt jsonb;
 idx integer; target_idx integer; attempt_idx integer; old_idx integer; result jsonb; ver integer; setup jsonb; selected uuid; changed boolean:=true; presence_new boolean:=false; bank public.interview_stations; child jsonb; child_ids uuid[]; child_position integer;
BEGIN
 IF p_actor_user_id IS NULL OR v_command_id IS NULL OR kind IS NULL THEN RAISE EXCEPTION 'Invalid interview command' USING ERRCODE='22023'; END IF;
 SELECT id INTO student FROM public.students WHERE user_id=p_actor_user_id LIMIT 1;
 -- Presence is a liveness hint, not assessment state. Avoid taking the
 -- round's update lock or running phase/rubric projections for every beat.
 IF kind='heartbeat' THEN
  SELECT * INTO r FROM public.interview_rounds WHERE id=(p_command->>'roundId')::uuid;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Round not found' USING ERRCODE='22023'; END IF;
  IF NOT(coalesce(actor=ANY(r.tutor_ids) OR actor=r.created_by,false) OR coalesce(student=ANY(r.student_ids) AND public.interview_student_has_access(student),false))
   THEN RAISE EXCEPTION 'Round access denied' USING ERRCODE='42501'; END IF;
  IF r.data->>'phase' IS DISTINCT FROM 'completed' THEN
   IF student IS NOT NULL AND student=ANY(r.student_ids) THEN
    presence_new:=NOT EXISTS(SELECT 1 FROM public.interview_presence WHERE round_id=r.id AND student_id=student AND last_seen_at>now()-interval '35 seconds');
    INSERT INTO public.interview_presence(round_id,student_id) VALUES(r.id,student)
     ON CONFLICT(round_id,student_id) DO UPDATE SET last_seen_at=now()
     WHERE interview_presence.last_seen_at < now()-interval '5 seconds';
   END IF;
   IF actor IS NOT NULL THEN
    presence_new:=presence_new OR NOT EXISTS(SELECT 1 FROM public.interview_tutor_presence WHERE round_id=r.id AND tutor_id=actor AND last_seen_at>now()-interval '35 seconds');
    INSERT INTO public.interview_tutor_presence(round_id,tutor_id) VALUES(r.id,actor)
     ON CONFLICT(round_id,tutor_id) DO UPDATE SET last_seen_at=now()
     WHERE interview_tutor_presence.last_seen_at < now()-interval '5 seconds';
   END IF;
  END IF;
  IF presence_new THEN PERFORM realtime.send(jsonb_build_object('id',r.id),'changed','interview-round:'||r.id,true); END IF;
  RETURN jsonb_build_object('id',r.id,'version',r.version);
 END IF;
 -- Optimistic conflicts use PT409: PostgREST treats 40001 as a retryable
 -- serialization failure and can retry an unchanged stale command indefinitely.
 -- Serialize duplicate HTTP retries before checking the receipt, including creates.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_user_id::text||v_command_id::text,0));
 SELECT * INTO receipt FROM public.interview_command_receipts WHERE actor_user_id=p_actor_user_id AND interview_command_receipts.command_id=v_command_id;
 IF FOUND THEN
  IF receipt.command<>p_command THEN RAISE EXCEPTION 'Command ID already used' USING ERRCODE='22023'; END IF;
  RETURN receipt.result;
 END IF;
 IF kind NOT IN ('heartbeat','tick') AND actor IS NULL THEN RAISE EXCEPTION 'Medicine interview tutor access required' USING ERRCODE='42501'; END IF;
 IF kind='saveCategory' THEN
  item:=p_command->'category'; entity_id:=(item->>'id')::uuid;
  IF item->>'parentId' IS NOT NULL AND EXISTS(WITH RECURSIVE parents AS (
    SELECT id,parent_id FROM public.interview_categories WHERE id=(item->>'parentId')::uuid
    UNION SELECT c.id,c.parent_id FROM public.interview_categories c JOIN parents p ON c.id=p.parent_id)
    SELECT 1 FROM parents WHERE id=entity_id) THEN RAISE EXCEPTION 'Category cannot contain itself' USING ERRCODE='22023'; END IF;
  INSERT INTO public.interview_categories(id,name,parent_id) VALUES(entity_id,item->>'name',(item->>'parentId')::uuid)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,parent_id=excluded.parent_id;
  ver:=1;
 ELSIF kind='saveTag' THEN
  item:=p_command->'tag'; entity_id:=(item->>'id')::uuid;
  INSERT INTO public.interview_tags(id,name) VALUES(entity_id,item->>'name') ON CONFLICT(id) DO UPDATE SET name=excluded.name; ver:=1;
 ELSIF kind='saveQuestion' THEN
  RAISE EXCEPTION 'Questions must be edited through their station' USING ERRCODE='22023';
 ELSIF kind IN ('saveStation','saveRubric') THEN
  item:=p_command->'station'; entity_id:=coalesce((item->>'id')::uuid,(p_command->>'stationId')::uuid);
  PERFORM pg_advisory_xact_lock(hashtextextended(entity_id::text,1));
  SELECT * INTO bank FROM public.interview_stations WHERE id=entity_id FOR UPDATE;
  IF kind='saveRubric' THEN
   SELECT * INTO q FROM public.interview_questions WHERE id=(p_command->>'questionId')::uuid AND station_id=entity_id FOR UPDATE;
   IF q.id IS NULL THEN RAISE EXCEPTION 'Station question not found' USING ERRCODE='22023'; END IF;
   IF expected IS DISTINCT FROM q.rubric_version THEN RAISE EXCEPTION 'Question changed; reload before saving' USING ERRCODE='PT409'; END IF;
   IF p_command->'rubric' IS NULL THEN RAISE EXCEPTION 'Invalid rubric' USING ERRCODE='22023'; END IF;
   UPDATE public.interview_questions SET rubric=p_command->'rubric',rubric_version=rubric_version+1,version=version+1,updated_at=now() WHERE id=q.id RETURNING * INTO q;
   UPDATE public.interview_stations SET version=version+1,updated_at=now() WHERE id=entity_id;
   INSERT INTO public.interview_rubric_revisions(question_id,version,rubric,actor_id) VALUES(q.id,q.rubric_version,q.rubric,actor);
   entity_id:=q.id; ver:=q.rubric_version;
  ELSE
   IF expected IS DISTINCT FROM coalesce(bank.version,0) THEN RAISE EXCEPTION 'Station changed; reload before saving' USING ERRCODE='PT409'; END IF;
   IF btrim(coalesce(item->>'name',''))='' OR item->'prompt' IS NULL OR NOT EXISTS(SELECT 1 FROM public.interview_categories WHERE id=(item->>'categoryId')::uuid)
    OR coalesce((item->>'maximumPoints')::numeric,0)<=0 OR (item->>'maximumPoints')::numeric>1000
    OR jsonb_typeof(item->'questions') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'questions') NOT BETWEEN 1 AND 100
   THEN RAISE EXCEPTION 'Invalid station' USING ERRCODE='22023'; END IF;
   ver:=coalesce(bank.version,0)+1;
   INSERT INTO public.interview_stations(id,version,name,category_id,prompt,maximum_points,archived)
    VALUES(entity_id,ver,item->>'name',(item->>'categoryId')::uuid,item->'prompt',(item->>'maximumPoints')::numeric,coalesce((item->>'archived')::boolean,false))
    ON CONFLICT(id) DO UPDATE SET version=excluded.version,name=excluded.name,category_id=excluded.category_id,prompt=excluded.prompt,
     maximum_points=excluded.maximum_points,archived=excluded.archived,updated_at=now();
   child_ids:='{}'; child_position:=0;
   FOR child IN SELECT value FROM jsonb_array_elements(item->'questions') LOOP
    SELECT * INTO q FROM public.interview_questions WHERE id=(child->>'id')::uuid FOR UPDATE;
    IF (child->>'id')::uuid IS NULL OR (child->>'id')::uuid=ANY(child_ids) OR (child->>'stationId')::uuid IS DISTINCT FROM entity_id
     OR (q.id IS NOT NULL AND q.station_id<>entity_id) OR jsonb_typeof(child->'tagIds') IS DISTINCT FROM 'array'
     OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(child->'tagIds') x WHERE NOT EXISTS(SELECT 1 FROM public.interview_tags WHERE id=x::uuid))
     OR child->'question' IS NULL OR child->'rubric' IS NULL OR coalesce((child->>'suggestedTimeSeconds')::integer,0) NOT BETWEEN 1 AND 7200
    THEN RAISE EXCEPTION 'Invalid station question' USING ERRCODE='22023'; END IF;
    child_ids:=array_append(child_ids,(child->>'id')::uuid);
    INSERT INTO public.interview_questions(id,station_id,position,version,tag_ids,question,rubric,rubric_version,suggested_time_seconds,archived)
     VALUES((child->>'id')::uuid,entity_id,child_position,coalesce(q.version,0)+1,
      ARRAY(SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(child->'tagIds')),child->'question',child->'rubric',
      coalesce(q.rubric_version,0)+CASE WHEN q.id IS NULL OR q.rubric IS DISTINCT FROM child->'rubric' THEN 1 ELSE 0 END,
      (child->>'suggestedTimeSeconds')::integer,false)
     ON CONFLICT(id) DO UPDATE SET position=excluded.position,version=excluded.version,tag_ids=excluded.tag_ids,question=excluded.question,
      rubric=excluded.rubric,rubric_version=excluded.rubric_version,suggested_time_seconds=excluded.suggested_time_seconds,archived=false,updated_at=now()
     WHERE interview_questions.station_id=excluded.station_id
     RETURNING * INTO q;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid station question' USING ERRCODE='22023'; END IF;
    INSERT INTO public.interview_rubric_revisions(question_id,version,rubric,actor_id) VALUES(q.id,q.rubric_version,q.rubric,actor) ON CONFLICT DO NOTHING;
    child_position:=child_position+1;
   END LOOP;
   UPDATE public.interview_questions SET archived=true WHERE station_id=entity_id AND NOT(id=ANY(child_ids));
  END IF;
 ELSIF kind='saveInterview' THEN
  item:=p_command->'interview'; entity_id:=(item->>'id')::uuid;
  PERFORM pg_advisory_xact_lock(hashtextextended(entity_id::text,1));
  SELECT * INTO t FROM public.interviews WHERE id=entity_id FOR UPDATE;
  IF expected IS DISTINCT FROM coalesce(t.version,0) THEN RAISE EXCEPTION 'Interview changed; reload before saving' USING ERRCODE='PT409'; END IF;
  PERFORM public.interview_validate_template(item); ver:=coalesce(t.version,0)+1;
  INSERT INTO public.interviews(id,version,data) VALUES(entity_id,ver,item)
   ON CONFLICT(id) DO UPDATE SET version=excluded.version,data=excluded.data,updated_at=now();
 ELSIF kind='createRound' THEN
  entity_id:=(p_command->>'roundId')::uuid; setup:=p_command->'setup'; d:=public.interview_setup_data(setup,actor,now()); ver:=1;
  INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
  VALUES(entity_id,(setup->>'interviewId')::uuid,actor,ARRAY(SELECT (value->>'tutorId')::uuid FROM jsonb_array_elements(setup->'assignments')),
   ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(setup->'studentIds')),d);
 ELSE
  entity_id:=(p_command->>'roundId')::uuid;
  SELECT * INTO r FROM public.interview_rounds WHERE id=entity_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Round not found' USING ERRCODE='22023'; END IF;
  IF kind IN ('heartbeat','tick') THEN
   IF NOT(coalesce(actor=ANY(r.tutor_ids) OR actor=r.created_by,false) OR coalesce(student=ANY(r.student_ids) AND public.interview_student_has_access(student),false))
    THEN RAISE EXCEPTION 'Round access denied' USING ERRCODE='42501'; END IF;
  ELSIF NOT coalesce(actor=ANY(r.tutor_ids) OR actor=r.created_by,false) THEN RAISE EXCEPTION 'Round access denied' USING ERRCODE='42501'; END IF;
  IF kind NOT IN ('heartbeat','tick','updateRound','start') AND NOT coalesce(actor=ANY(r.tutor_ids),false) THEN RAISE EXCEPTION 'Only participating tutors may control the round' USING ERRCODE='42501'; END IF;
  d:=public.interview_effective_state(r.data); changed:=d IS DISTINCT FROM r.data;
  IF kind NOT IN ('heartbeat','tick','saveAttempt') AND expected IS DISTINCT FROM r.version THEN RAISE EXCEPTION 'Round changed; reload before trying again' USING ERRCODE='PT409'; END IF;
  SELECT value,(ordinality-1)::integer INTO progress,idx FROM jsonb_array_elements(d->'progress') WITH ORDINALITY WHERE value->>'tutorId'=actor::text;
  SELECT value INTO station FROM jsonb_array_elements(d->'stations') WHERE value->>'id'=progress->>'stationId';
  IF kind='heartbeat' THEN
   IF student IS NOT NULL THEN INSERT INTO public.interview_presence(round_id,student_id) VALUES(r.id,student)
     ON CONFLICT(round_id,student_id) DO UPDATE SET last_seen_at=now(); END IF;
   IF actor IS NOT NULL THEN INSERT INTO public.interview_tutor_presence(round_id,tutor_id) VALUES(r.id,actor)
     ON CONFLICT(round_id,tutor_id) DO UPDATE SET last_seen_at=now(); END IF;
  ELSIF kind='tick' THEN NULL;
  ELSIF kind='updateRound' THEN
   IF d->>'startedAt' IS NOT NULL THEN RAISE EXCEPTION 'Assignments are fixed after start' USING ERRCODE='22023'; END IF;
   setup:=p_command->'setup'; d:=public.interview_setup_data(setup,r.created_by,(d->>'createdAt')::timestamptz);
   r.interview_id:=(setup->>'interviewId')::uuid;
   r.tutor_ids:=ARRAY(SELECT (value->>'tutorId')::uuid FROM jsonb_array_elements(setup->'assignments'));
   r.student_ids:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(setup->'studentIds')); changed:=true;
  ELSIF kind='start' THEN
   IF d->>'startedAt' IS NOT NULL THEN RAISE EXCEPTION 'Round already started' USING ERRCODE='22023'; END IF;
   d:=public.interview_setup_data(d,r.created_by,(d->>'createdAt')::timestamptz) || jsonb_build_object('startedAt',now(),'phaseStartedAt',now(),'sharedAction',jsonb_build_object('type','start','actorId',to_jsonb(actor))); changed:=true;
  ELSIF kind='ready' THEN
   IF idx IS NULL OR d->>'phase'<>'waiting' OR d->>'startedAt' IS NULL THEN RAISE EXCEPTION 'Cannot change readiness now' USING ERRCODE='22023'; END IF;
   d:=jsonb_set(d,ARRAY['progress',idx::text,'ready'],to_jsonb(coalesce((p_command->>'ready')::boolean,false))); changed:=true;
  ELSIF kind='startReading' THEN
   IF d->>'startedAt' IS NULL OR d->>'phase'<>'waiting' OR d->>'pausedAt' IS NOT NULL
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE NOT (p->>'ready')::boolean)
    THEN RAISE EXCEPTION 'Every tutor must be ready' USING ERRCODE='22023'; END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE p->>'studentId' IS NOT NULL) THEN RAISE EXCEPTION 'At least one station needs a student' USING ERRCODE='22023'; END IF;
   IF d->>'delivery'='online' AND NOT coalesce((p_command->>'overrideMissingStudents')::boolean,false)
    AND EXISTS(SELECT 1 FROM unnest(r.student_ids) s WHERE NOT EXISTS(SELECT 1 FROM public.interview_presence WHERE round_id=r.id AND student_id=s AND last_seen_at>now()-interval '35 seconds'))
    THEN RAISE EXCEPTION 'Students are disconnected; explicit override required' USING ERRCODE='22023'; END IF;
   d:=public.interview_close_phase(d,now()) || jsonb_build_object('phase','reading','phaseStartedAt',now(),'phaseDeadline',now()+make_interval(secs=>(d->>'readingTimeSeconds')::integer),'sharedAction',jsonb_build_object('type','startReading','actorId',to_jsonb(actor))); changed:=true;
  ELSIF kind='skipReading' THEN
   IF d->>'startedAt' IS NULL OR d->>'phase'<>'reading' OR d->>'pausedAt' IS NOT NULL THEN RAISE EXCEPTION 'Cannot skip reading now' USING ERRCODE='22023'; END IF;
   d:=public.interview_close_phase(d,now()) || jsonb_build_object('phase','questions','phaseStartedAt',now(),'phaseDeadline',now()+make_interval(secs=>(d->>'questionTimeSeconds')::integer),'sharedAction',jsonb_build_object('type','skipReading','actorId',to_jsonb(actor))); changed:=true;
  ELSIF kind='pause' THEN
   IF d->>'pausedAt' IS NOT NULL OR d->>'phase'='completed' OR d->>'startedAt' IS NULL THEN RAISE EXCEPTION 'Cannot pause now' USING ERRCODE='22023'; END IF;
   d:=d || jsonb_build_object('pausedAt',now(),'pausedBy',to_jsonb(actor),'remainingMilliseconds',greatest(0,extract(epoch FROM ((d->>'phaseDeadline')::timestamptz-now()))*1000),'sharedAction',jsonb_build_object('type','pause','actorId',to_jsonb(actor))); changed:=true;
  ELSIF kind='resume' THEN
   IF d->>'pausedAt' IS NULL THEN RAISE EXCEPTION 'Round is not paused' USING ERRCODE='22023'; END IF;
   d:=d || jsonb_build_object('phaseDeadline',CASE WHEN d->>'phaseDeadline' IS NOT NULL THEN now()+make_interval(secs=>(d->>'remainingMilliseconds')::double precision/1000) ELSE NULL END,
    'phaseStartedAt',(d->>'phaseStartedAt')::timestamptz + (now()-(d->>'pausedAt')::timestamptz),'pausedAt',NULL,'pausedBy',NULL,'remainingMilliseconds',NULL,'sharedAction',jsonb_build_object('type','resume','actorId',to_jsonb(actor))); changed:=true;
  ELSIF kind IN ('endStation','finishFeedback') THEN
   IF idx IS NULL OR d->>'phase' NOT IN ('questions','feedback') OR d->>'pausedAt' IS NOT NULL THEN RAISE EXCEPTION 'Station cannot finish now' USING ERRCODE='22023'; END IF;
   IF kind='endStation' THEN
    d:=jsonb_set(d,ARRAY['progress',idx::text,'endedEarly'],'true');
   ELSE
    IF d->>'phase'='questions' AND NOT (progress->>'endedEarly')::boolean THEN RAISE EXCEPTION 'End the station before finishing feedback' USING ERRCODE='22023'; END IF;
    SELECT value,(ordinality-1)::integer INTO attempt,attempt_idx FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY a
     WHERE a.value->>'stationId'=progress->>'stationId' AND a.value->>'studentId'=progress->>'studentId';
    IF progress->>'studentId' IS NOT NULL AND (attempt IS NULL OR (attempt->>'score' IS NULL AND coalesce(btrim(attempt->>'notAssessedReason'),'')='')) THEN
     RAISE EXCEPTION 'Score this station or mark it not scored' USING ERRCODE='22023'; END IF;
    d:=jsonb_set(d,ARRAY['progress',idx::text,'feedbackComplete'],'true');
    IF attempt_idx IS NOT NULL THEN d:=jsonb_set(d,ARRAY['attempts',attempt_idx::text,'completed'],'true'); END IF;
   END IF; changed:=true;
  ELSIF kind='next' THEN
   IF (d->>'phase' NOT IN ('questions','feedback') AND NOT (d->>'delivery'='in_person' AND d->>'phase'='waiting' AND d->>'startedAt' IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'attempts') a WHERE NOT public.interview_attempt_resolved(a)))) OR d->>'pausedAt' IS NOT NULL
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE p->>'studentId' IS NOT NULL AND NOT (p->>'feedbackComplete')::boolean
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'attempts') a WHERE a->>'studentId'=p->>'studentId' AND a->>'stationId'=p->>'stationId' AND nullif(btrim(a->>'notAssessedReason'),'') IS NOT NULL))
    THEN RAISE EXCEPTION 'Every station must finish feedback' USING ERRCODE='22023'; END IF;
   d:=public.interview_close_phase(d,now());
   IF (d->>'delivery'='in_person' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'attempts') a WHERE NOT public.interview_attempt_resolved(a))) OR (d->>'delivery' IS DISTINCT FROM 'in_person' AND (d->>'rotation')::integer+1>=jsonb_array_length(d->'stations')) THEN
    d:=d || jsonb_build_object('phase','completed','phaseDeadline',NULL,'phaseStartedAt',now(),'stations',public.interview_round_json(r)->'stations','sharedAction',jsonb_build_object('type','next','actorId',to_jsonb(actor)));
   ELSE
    d:=d || jsonb_build_object('rotation',(d->>'rotation')::integer+1,'phase','waiting','phaseDeadline',NULL,'phaseStartedAt',now(),'sharedAction',jsonb_build_object('type','next','actorId',to_jsonb(actor)));
    SELECT jsonb_agg(p.value || jsonb_build_object('ready',false,'endedEarly',false,'feedbackComplete',false,'studentId',
      CASE WHEN d->>'delivery'='online' THEN to_jsonb(r.student_ids[((p.ordinality-1-(d->>'rotation')::integer+jsonb_array_length(d->'stations')) % jsonb_array_length(d->'stations'))+1]) ELSE 'null'::jsonb END) ORDER BY p.ordinality)
     INTO item FROM jsonb_array_elements(d->'progress') WITH ORDINALITY p;
    d:=jsonb_set(d,'{progress}',item);
   END IF; changed:=true;
  ELSIF kind='claimStudent' THEN
   IF idx IS NULL OR d->>'delivery'<>'in_person' OR d->>'phase'<>'waiting' OR coalesce((progress->>'ready')::boolean,false) THEN RAISE EXCEPTION 'Cannot select a student now' USING ERRCODE='22023'; END IF;
   selected:=(p_command->>'studentId')::uuid;
   IF selected IS NOT NULL AND (NOT(selected=ANY(r.student_ids)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE p->>'studentId'=selected::text AND p->>'stationId'<>progress->>'stationId'))
    THEN RAISE EXCEPTION 'Student is already at another station or not in this round' USING ERRCODE='22023'; END IF;
   SELECT value,(ordinality-1)::integer INTO old_attempt,old_idx FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY WHERE value->>'stationId'=progress->>'stationId' AND value->>'studentId'=progress->>'studentId';
   SELECT value,(ordinality-1)::integer INTO target_attempt,target_idx FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY WHERE value->>'stationId'=progress->>'stationId' AND value->>'studentId'=selected::text;
   IF selected::text IS DISTINCT FROM progress->>'studentId' THEN
    IF coalesce((target_attempt->>'completed')::boolean,false) THEN RAISE EXCEPTION 'Student has already completed this station' USING ERRCODE='22023'; END IF;
    IF old_attempt->>'score' IS NOT NULL OR old_attempt->>'notAssessedReason' IS NOT NULL OR public.interview_feedback_has_text(old_attempt->'generalFeedback') OR jsonb_array_length(coalesce(old_attempt->'feedback','[]'))>0 OR EXISTS(SELECT 1 FROM public.interview_recordings WHERE round_id=r.id AND attempt_id=(old_attempt->>'id')::uuid) THEN
     IF NOT coalesce((p_command->>'confirmMove')::boolean,false) OR selected IS NULL THEN RAISE EXCEPTION 'Confirm moving existing feedback and score' USING ERRCODE='22023'; END IF;
     IF target_attempt->>'score' IS NOT NULL OR target_attempt->>'notAssessedReason' IS NOT NULL OR public.interview_feedback_has_text(target_attempt->'generalFeedback') OR jsonb_array_length(target_attempt->'feedback')>0 OR EXISTS(SELECT 1 FROM public.interview_recordings WHERE round_id=r.id AND attempt_id=(target_attempt->>'id')::uuid) THEN RAISE EXCEPTION 'Target student already has assessment entries' USING ERRCODE='22023'; END IF;
     d:=jsonb_set(d,ARRAY['attempts',target_idx::text],target_attempt || jsonb_build_object('score',old_attempt->'score','notAssessedReason',old_attempt->'notAssessedReason','feedback',old_attempt->'feedback','generalFeedback',coalesce(old_attempt->'generalFeedback','null'::jsonb),'version',(target_attempt->>'version')::integer+1,'updatedAt',now(),'updatedBy',actor));
     d:=jsonb_set(d,ARRAY['attempts',old_idx::text],old_attempt || jsonb_build_object('score',NULL,'notAssessedReason',NULL,'feedback','[]'::jsonb,'generalFeedback',NULL,'version',(old_attempt->>'version')::integer+1,'updatedAt',now(),'updatedBy',actor));
     UPDATE public.interview_recordings SET attempt_id=(target_attempt->>'id')::uuid WHERE round_id=r.id AND attempt_id=(old_attempt->>'id')::uuid;
    END IF;
    d:=jsonb_set(d,ARRAY['progress',idx::text,'studentId'],coalesce(to_jsonb(selected),'null')); changed:=true;
   END IF;
  ELSIF kind='saveAttempt' THEN
   SELECT value,(ordinality-1)::integer INTO attempt,attempt_idx FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY WHERE value->>'id'=p_command->>'attemptId';
   IF attempt IS NULL OR attempt->>'stationId' IS DISTINCT FROM progress->>'stationId' THEN RAISE EXCEPTION 'Only the assigned tutor may mark this station' USING ERRCODE='42501'; END IF;
   IF (p_command->>'expectedAttemptVersion')::integer IS DISTINCT FROM (attempt->>'version')::integer THEN RAISE EXCEPTION 'Assessment changed; reload before saving' USING ERRCODE='PT409'; END IF;
   IF d->>'startedAt' IS NULL OR jsonb_typeof(p_command->'feedback') IS DISTINCT FROM 'array'
    OR (p_command->>'score')::numeric<0 OR (p_command->>'score')::numeric>(station->>'maximumPoints')::numeric
    OR (p_command->>'notAssessedReason' IS NOT NULL AND (btrim(p_command->>'notAssessedReason')='' OR p_command->>'score' IS NOT NULL))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'feedback') f WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(station->'questions') p WHERE p->>'id'=f->>'placementId'))
    OR (SELECT count(*) FROM jsonb_array_elements(p_command->'feedback'))<>(SELECT count(DISTINCT f->>'placementId') FROM jsonb_array_elements(p_command->'feedback') f)
    THEN RAISE EXCEPTION 'Invalid station assessment' USING ERRCODE='22023'; END IF;
   ver:=(attempt->>'version')::integer+1;
   d:=jsonb_set(d,ARRAY['attempts',attempt_idx::text],attempt || jsonb_build_object('score',p_command->'score','notAssessedReason',p_command->'notAssessedReason','feedback',p_command->'feedback','generalFeedback',coalesce(p_command->'generalFeedback',attempt->'generalFeedback','null'::jsonb),'completed',CASE WHEN d->>'phase'='completed' AND p_command->>'score' IS NOT NULL THEN true ELSE (attempt->>'completed')::boolean END,'version',ver,'updatedAt',now(),'updatedBy',actor)); changed:=true;
  ELSIF kind='release' THEN
   IF idx IS NULL OR d->>'phase'<>'completed' OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->'attempts') a WHERE (a->>'score' IS NULL AND a->>'notAssessedReason' IS NULL) OR (a->>'notAssessedReason' IS NULL AND NOT (a->>'completed')::boolean))
    THEN RAISE EXCEPTION 'Every station needs a completed score or an explicit not-assessed reason before release' USING ERRCODE='22023'; END IF;
   SELECT jsonb_agg(jsonb_build_object('studentId',student_id,'releasedAt',now(),'revision',coalesce((SELECT (value->>'revision')::integer FROM jsonb_array_elements(d->'releasedResults') WHERE value->>'studentId'=student_id::text),0)+1,
    'score',(SELECT coalesce(sum((a->>'score')::numeric),0) FROM jsonb_array_elements(d->'attempts') a WHERE a->>'studentId'=student_id::text),
    'possiblePoints',(SELECT coalesce(sum((s->>'maximumPoints')::numeric),0) FROM jsonb_array_elements(d->'attempts') a JOIN jsonb_array_elements(d->'stations') s ON s->>'id'=a->>'stationId' WHERE a->>'studentId'=student_id::text AND a->>'notAssessedReason' IS NULL),
    'partial',EXISTS(SELECT 1 FROM jsonb_array_elements(d->'attempts') a WHERE a->>'studentId'=student_id::text AND a->>'notAssessedReason' IS NOT NULL),
    'attempts',(SELECT jsonb_agg(a) FROM jsonb_array_elements(d->'attempts') a WHERE a->>'studentId'=student_id::text),
    'recordings',(SELECT coalesce(jsonb_agg(public.interview_recording_json(rec)),'[]') FROM public.interview_recordings rec WHERE round_id=r.id AND rec.attempt_id::text IN (SELECT a->>'id' FROM jsonb_array_elements(d->'attempts') a WHERE a->>'studentId'=student_id::text))))
    INTO item FROM unnest(r.student_ids) student_id;
   INSERT INTO public.interview_result_releases(round_id,student_id,revision,snapshot,released_by)
    SELECT r.id,(value->>'studentId')::uuid,(value->>'revision')::integer,value,actor FROM jsonb_array_elements(item);
   d:=jsonb_set(d,'{releasedResults}',item); changed:=true;
  ELSE RAISE EXCEPTION 'Unknown interview command' USING ERRCODE='22023'; END IF;
  IF changed THEN
   UPDATE public.interview_rounds SET data=d,version=version+CASE WHEN kind='saveAttempt' AND d->>'phase'=r.data->>'phase' THEN 0 ELSE 1 END,tutor_ids=r.tutor_ids,student_ids=r.student_ids,interview_id=r.interview_id,updated_at=now() WHERE id=r.id RETURNING version INTO r.version;
  END IF;
  ver:=CASE WHEN kind='saveAttempt' THEN ver ELSE r.version END;
 END IF;
 IF kind IN ('createRound','updateRound','start') THEN
  SELECT * INTO r FROM public.interview_rounds WHERE id=entity_id;
  INSERT INTO public.notifications(student_id,app_scope,notification_type,title,body,action_url,dedupe_key,metadata)
   SELECT s,'student_web','interview_round',CASE WHEN kind='start' THEN 'Interview waiting room is open' ELSE 'Your interview is scheduled' END,
    r.data->>'name','/interviews/rounds/'||r.id,'interview:'||r.id||':'||s||':'||CASE WHEN kind='start' THEN 'open' ELSE 'scheduled' END,jsonb_build_object('roundId',r.id)
   FROM unnest(r.student_ids) s ON CONFLICT(dedupe_key) DO NOTHING;
  INSERT INTO public.notifications(staff_id,app_scope,notification_type,title,body,action_url,dedupe_key,metadata)
   SELECT s,'staff_web','interview_round',CASE WHEN kind='start' THEN 'Interview waiting room is open' ELSE 'You are assigned to an interview' END,
    r.data->>'name','/interviews/rounds/'||r.id,'interview:'||r.id||':'||s||':'||CASE WHEN kind='start' THEN 'open' ELSE 'scheduled' END,jsonb_build_object('roundId',r.id)
   FROM unnest(r.tutor_ids) s ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 result:=jsonb_build_object('id',entity_id,'version',ver);
 IF kind NOT IN ('heartbeat','tick') THEN
  INSERT INTO public.interview_command_receipts(actor_user_id,command_id,command,result) VALUES(p_actor_user_id,v_command_id,p_command,result);
 END IF;
 RETURN result;
END;
$$;
