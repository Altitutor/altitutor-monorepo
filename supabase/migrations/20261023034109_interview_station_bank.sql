-- DEV-226: whole stations are reusable; questions are station-owned children.
CREATE TABLE public.interview_stations (
 id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1,
 name text NOT NULL CHECK (btrim(name) <> ''),
 category_id uuid NOT NULL REFERENCES public.interview_categories(id),
 prompt jsonb NOT NULL, maximum_points numeric NOT NULL DEFAULT 6 CHECK (maximum_points > 0 AND maximum_points <= 1000),
 archived boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_stations_category ON public.interview_stations(category_id);
ALTER TABLE public.interview_questions ADD COLUMN station_id uuid REFERENCES public.interview_stations(id),
 ADD COLUMN position integer NOT NULL DEFAULT 0 CHECK (position >= 0);
CREATE INDEX interview_questions_station ON public.interview_questions(station_id,position);
ALTER TABLE public.interview_stations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interview_stations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.interview_stations TO service_role;
CREATE POLICY interview_stations_admin ON public.interview_stations TO authenticated
 USING ((select public.is_adminstaff_active())) WITH CHECK ((select public.is_adminstaff_active()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interview_stations TO authenticated;

-- Preserve every authored station, including repeated/global question uses.
-- Runtime occurrence and feedback IDs are retained; only source-bank identities
-- in active snapshots are remapped. Immutable released/completed content stays put.
CREATE TEMP TABLE interview_station_backfill (
 interview_id uuid, occurrence_id uuid, placement_id uuid,
 station_id uuid, question_id uuid,
 PRIMARY KEY(interview_id,occurrence_id,placement_id)
) ON COMMIT DROP;
DO $backfill$
DECLARE t record; s jsonb; placement jsonb; q public.interview_questions;
 sid uuid; qid uuid; firstq public.interview_questions; fallback uuid; refs jsonb;
BEGIN
 SELECT id INTO fallback FROM public.interview_categories ORDER BY id LIMIT 1;
 IF fallback IS NULL AND EXISTS(SELECT 1 FROM public.interviews) THEN
  fallback:=gen_random_uuid();
  INSERT INTO public.interview_categories(id,name) VALUES(fallback,'Uncategorised');
 END IF;
 FOR t IN SELECT * FROM public.interviews ORDER BY id LOOP
  refs:='[]';
  FOR s IN SELECT value FROM jsonb_array_elements(t.data->'stations') LOOP
   sid:=gen_random_uuid();
   SELECT * INTO firstq FROM public.interview_questions WHERE id=(s->'questions'->0->>'questionId')::uuid;
   INSERT INTO public.interview_stations(id,name,category_id,prompt,maximum_points,archived)
   VALUES(sid,s->>'name',coalesce(firstq.category_id,fallback),coalesce(firstq.prompt,'null'::jsonb),
     (s->>'maximumPoints')::numeric,coalesce((t.data->>'archived')::boolean,false));
   FOR placement IN SELECT value || jsonb_build_object('position',ordinality-1)
     FROM jsonb_array_elements(s->'questions') WITH ORDINALITY LOOP
    SELECT * INTO STRICT q FROM public.interview_questions WHERE id=(placement->>'questionId')::uuid;
    IF q.station_id IS NULL THEN
     qid:=q.id;
     UPDATE public.interview_questions SET station_id=sid,position=(placement->>'position')::integer,archived=false WHERE id=qid;
    ELSE
     qid:=gen_random_uuid();
     INSERT INTO public.interview_questions(id,version,category_id,tag_ids,question,prompt,rubric,rubric_version,suggested_time_seconds,station_id,position)
     VALUES(qid,q.version,q.category_id,q.tag_ids,q.question,q.prompt,q.rubric,q.rubric_version,q.suggested_time_seconds,sid,(placement->>'position')::integer);
     INSERT INTO public.interview_rubric_revisions(question_id,version,rubric,actor_id,created_at)
       SELECT qid,version,rubric,actor_id,created_at FROM public.interview_rubric_revisions WHERE question_id=q.id;
    END IF;
    INSERT INTO interview_station_backfill VALUES(t.id,(s->>'id')::uuid,(placement->>'id')::uuid,sid,qid);
   END LOOP;
   refs:=refs || jsonb_build_array(jsonb_build_object('id',s->'id','stationId',sid));
  END LOOP;
  UPDATE public.interviews SET data=jsonb_set(data,'{stations}',refs),version=version+1 WHERE id=t.id;
 END LOOP;
 -- Unplaced bank questions become one-question stations, preserving their content.
 FOR q IN SELECT * FROM public.interview_questions WHERE station_id IS NULL LOOP
  sid:=gen_random_uuid();
  INSERT INTO public.interview_stations(id,name,category_id,prompt,archived)
   VALUES(sid,coalesce(nullif(left(q.question#>>'{}',80),''),'Imported station'),q.category_id,q.prompt,q.archived);
  UPDATE public.interview_questions SET station_id=sid,position=0,archived=false WHERE id=q.id;
 END LOOP;
 UPDATE public.interview_rounds r SET data=jsonb_set(r.data,'{stations}',(
  SELECT jsonb_agg(s.value || jsonb_build_object('stationId',coalesce(
    (SELECT b.station_id FROM interview_station_backfill b WHERE b.interview_id=r.interview_id AND b.occurrence_id=(s.value->>'id')::uuid LIMIT 1),
    (SELECT source_q.station_id FROM public.interview_questions source_q WHERE source_q.id=(s.value->'questions'->0->>'questionId')::uuid)),
   'prompt',s.value->'questions'->0->'prompt','questions',(
    SELECT jsonb_agg(p.value || jsonb_build_object('questionId',coalesce(
     (SELECT b.question_id FROM interview_station_backfill b WHERE b.interview_id=r.interview_id AND b.occurrence_id=(s.value->>'id')::uuid AND b.placement_id=(p.value->>'id')::uuid),
     (p.value->>'questionId')::uuid)) ORDER BY p.ordinality)
    FROM jsonb_array_elements(s.value->'questions') WITH ORDINALITY p)) ORDER BY s.ordinality)
  FROM jsonb_array_elements(r.data->'stations') WITH ORDINALITY s))
 WHERE r.data->>'phase'<>'completed';
END;
$backfill$;
ALTER TABLE public.interview_questions ALTER COLUMN station_id SET NOT NULL;
-- Retire the old per-question prompt/category columns only after all references
-- below have been replaced. Removed questions remain soft-retired for rubric history.

CREATE OR REPLACE FUNCTION public.interview_question_json(q public.interview_questions) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT jsonb_build_object('id',q.id,'stationId',q.station_id,'tagIds',q.tag_ids,
 'question',q.question,'rubric',q.rubric,'rubricVersion',q.rubric_version,'suggestedTimeSeconds',q.suggested_time_seconds);
$$;
-- Nested table reads in a security-definer view still run with the function's
-- own privileges. Guard and reload the station before projecting owned children;
-- tutors retain no base-table rows and students cannot call this as a bypass.
CREATE FUNCTION public.interview_station_json(s public.interview_stations) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role',false)
  AND public.interview_tutor_id((select auth.uid())) IS NULL THEN RETURN NULL; END IF;
 SELECT source.* INTO s FROM public.interview_stations source WHERE source.id=s.id;
 IF s.id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',s.id,'version',s.version,'name',s.name,'categoryId',s.category_id,
 'prompt',s.prompt,'maximumPoints',s.maximum_points,'archived',s.archived,'updatedAt',s.updated_at,
 'questions',(SELECT coalesce(jsonb_agg(public.interview_question_json(q) ORDER BY q.position,q.id),'[]')
 FROM public.interview_questions q WHERE q.station_id=s.id AND NOT q.archived));
END;
$$;
REVOKE ALL ON FUNCTION public.interview_station_json(public.interview_stations) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.interview_station_json(public.interview_stations) TO authenticated,service_role;

CREATE OR REPLACE VIEW public.vtutor_interview_catalog WITH (security_invoker=false) AS
SELECT jsonb_build_object('actorId',public.interview_tutor_id((select auth.uid())),
 'categories',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'parentId',parent_id) ORDER BY name),'[]') FROM public.interview_categories),
 'tags',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name),'[]') FROM public.interview_tags),
 'stations',(SELECT coalesce(jsonb_agg(public.interview_station_json(s) ORDER BY s.updated_at DESC),'[]') FROM public.interview_stations s),
 'interviews',(SELECT coalesce(jsonb_agg(data || jsonb_build_object('id',id,'version',version,'updatedAt',updated_at) ORDER BY updated_at DESC),'[]') FROM public.interviews),
 'tutors',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',first_name||' '||last_name) ORDER BY first_name),'[]') FROM public.staff WHERE public.interview_tutor_id(user_id)=id),
 'students',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name,'classIds',
    (SELECT coalesce(jsonb_agg(cs.class_id),'[]') FROM public.classes_students cs JOIN public.classes c ON c.id=cs.class_id JOIN public.subjects sub ON sub.id=c.subject_id
     WHERE cs.student_id=s.id AND cs.enrolled_at<=now() AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at>now()) AND lower(btrim(sub.name))='medicine interview')) ORDER BY s.first_name),'[]')
     FROM public.students s WHERE public.interview_student_has_access(s.id)),
 'classes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',coalesce(c.long_name,c.short_name,'Interview class')) ORDER BY c.long_name),'[]') FROM public.classes c JOIN public.subjects sub ON sub.id=c.subject_id WHERE lower(btrim(sub.name))='medicine interview')) AS data
WHERE public.interview_tutor_id((select auth.uid())) IS NOT NULL;

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
    WHERE round_id=r.id AND last_seen_at > now()-interval '20 seconds'),
  'recordings',(SELECT coalesce(jsonb_agg(public.interview_recording_json(rec) ORDER BY rec.created_at),'[]') FROM public.interview_recordings rec WHERE rec.round_id=r.id AND NOT (rec.id IS NOT DISTINCT FROM rec.capture_id AND EXISTS(SELECT 1 FROM public.interview_recordings child WHERE child.capture_id=rec.id AND child.id<>rec.id))));
END;
$$;


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
  'scheduledAt',d->'scheduledAt','startedAt',d->'startedAt','phase',d->'phase','rotation',d->'rotation','pausedAt',d->'pausedAt',
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

CREATE OR REPLACE FUNCTION public.interview_validate_template(d jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s jsonb; ids uuid[]:='{}';
BEGIN
 IF btrim(coalesce(d->>'name',''))='' OR d->>'readingTimeSeconds' IS NULL OR d->>'questionTimeSeconds' IS NULL
 OR (d->>'readingTimeSeconds')::integer NOT BETWEEN 1 AND 3600 OR (d->>'questionTimeSeconds')::integer NOT BETWEEN 1 AND 7200
 OR jsonb_typeof(d->'stations') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'stations')>6
 THEN RAISE EXCEPTION 'Invalid interview details' USING ERRCODE='22023'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(d->'stations') LOOP
  IF (s->>'id')::uuid IS NULL OR (s->>'id')::uuid=ANY(ids) OR NOT EXISTS(SELECT 1 FROM public.interview_stations WHERE id=(s->>'stationId')::uuid)
   OR s ? 'questions' OR s ? 'maximumPoints' OR s ? 'prompt' OR s ? 'name'
  THEN RAISE EXCEPTION 'Invalid station placement' USING ERRCODE='22023'; END IF;
  ids:=array_append(ids,(s->>'id')::uuid);
 END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.interview_setup_data(p_setup jsonb,p_actor uuid,p_created_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE template jsonb; stations jsonb; progress jsonb; attempts jsonb; selected_students uuid[]; tutors uuid[]; station_count integer;
BEGIN
 SELECT data INTO template FROM public.interviews WHERE id=(p_setup->>'interviewId')::uuid;
 IF template IS NULL OR coalesce((template->>'archived')::boolean,false) THEN RAISE EXCEPTION 'Interview unavailable' USING ERRCODE='22023'; END IF;
 PERFORM public.interview_validate_template(template);
 SELECT jsonb_agg(public.interview_station_json(bank) || s.value || jsonb_build_object('questions',
   (SELECT jsonb_agg(public.interview_question_json(q) || jsonb_build_object('questionId',q.id) ORDER BY q.position,q.id)
    FROM public.interview_questions q WHERE q.station_id=bank.id AND NOT q.archived)) ORDER BY s.ordinality)
 INTO stations FROM jsonb_array_elements(template->'stations') WITH ORDINALITY s JOIN public.interview_stations bank ON bank.id=(s.value->>'stationId')::uuid;
 template:=jsonb_set(template,'{stations}',coalesce(stations,'[]'));
 station_count:=jsonb_array_length(template->'stations');
 SELECT array_agg(value::uuid) INTO selected_students FROM jsonb_array_elements_text(p_setup->'studentIds');
 SELECT array_agg((value->>'tutorId')::uuid) INTO tutors FROM jsonb_array_elements(p_setup->'assignments');
 IF station_count<1 OR btrim(coalesce(p_setup->>'name',''))='' OR p_setup->>'delivery' NOT IN ('online','in_person') OR p_setup->>'mode' NOT IN ('exam','feedback') OR p_setup->>'delivery' IS NULL OR p_setup->>'mode' IS NULL
 OR cardinality(selected_students) IS NULL OR cardinality(selected_students)>station_count OR cardinality(tutors) IS DISTINCT FROM station_count
 OR (SELECT count(DISTINCT x) FROM unnest(selected_students) x)<>cardinality(selected_students)
 OR (SELECT count(DISTINCT x) FROM unnest(tutors) x)<>cardinality(tutors)
 OR EXISTS(SELECT 1 FROM unnest(selected_students) x WHERE NOT public.interview_student_has_access(x))
 OR EXISTS(SELECT 1 FROM unnest(tutors) x WHERE NOT EXISTS(SELECT 1 FROM public.staff WHERE id=x AND public.interview_tutor_id(user_id)=id))
 OR (SELECT count(DISTINCT a->>'stationId') FROM jsonb_array_elements(p_setup->'assignments') a)<>station_count
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_setup->'assignments') a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(template->'stations') s WHERE s->>'id'=a->>'stationId'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(template->'stations') s WHERE coalesce(jsonb_array_length(s->'questions'),0)=0)
 THEN RAISE EXCEPTION 'Invalid round participants or stations' USING ERRCODE='22023'; END IF;
 IF p_setup->>'scheduledAt' IS NOT NULL THEN PERFORM (p_setup->>'scheduledAt')::timestamptz; END IF;
 stations:=template->'stations';
 SELECT jsonb_agg(jsonb_build_object('stationId',s.value->'id','tutorId',a->'tutorId','studentId',
   CASE WHEN p_setup->>'delivery'='online' THEN to_jsonb(selected_students[s.ordinality]) ELSE 'null'::jsonb END,
   'ready',false,'endedEarly',false,'feedbackComplete',false) ORDER BY s.ordinality)
 INTO progress FROM jsonb_array_elements(stations) WITH ORDINALITY s JOIN jsonb_array_elements(p_setup->'assignments') a ON a->>'stationId'=s.value->>'id';
 SELECT jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'studentId',student,'stationId',s->'id','version',1,'score',NULL,'notAssessedReason',NULL,
  'feedback','[]'::jsonb,'completed',false,'updatedAt',now(),'updatedBy',NULL)) INTO attempts FROM unnest(selected_students) student CROSS JOIN jsonb_array_elements(stations) s;
 RETURN p_setup || jsonb_build_object('createdBy',p_actor,'createdAt',p_created_at,'startedAt',NULL,'phase','waiting','rotation',0,'phaseStartedAt',now(),'phaseDeadline',NULL,
  'pausedAt',NULL,'remainingMilliseconds',NULL,'readingTimeSeconds',template->'readingTimeSeconds','questionTimeSeconds',template->'questionTimeSeconds',
  'stations',stations,'progress',progress,'attempts',attempts,'releasedResults','[]'::jsonb,
  'students',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',first_name||' '||last_name)) FROM public.students WHERE id=ANY(selected_students)),
  'tutors',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',first_name||' '||last_name)) FROM public.staff WHERE id=ANY(tutors)));
END;
$$;

CREATE OR REPLACE FUNCTION public.interview_command(p_actor_user_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 kind text:=p_command->>'type'; actor uuid:=public.interview_tutor_id(p_actor_user_id); student uuid;
 v_command_id uuid:=(p_command->>'commandId')::uuid; receipt public.interview_command_receipts;
 entity_id uuid; expected integer:=(p_command->>'expectedVersion')::integer; q public.interview_questions; t public.interviews; r public.interview_rounds;
 d jsonb; item jsonb; progress jsonb; station jsonb; attempt jsonb; target_attempt jsonb; old_attempt jsonb;
 idx integer; target_idx integer; attempt_idx integer; old_idx integer; result jsonb; ver integer; setup jsonb; selected uuid; changed boolean:=true; bank public.interview_stations; child jsonb; child_ids uuid[]; child_position integer;
BEGIN
 IF p_actor_user_id IS NULL OR v_command_id IS NULL OR kind IS NULL THEN RAISE EXCEPTION 'Invalid interview command' USING ERRCODE='22023'; END IF;
 SELECT id INTO student FROM public.students WHERE user_id=p_actor_user_id LIMIT 1;
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
  ELSIF kind='tick' THEN NULL;
  ELSIF kind='updateRound' THEN
   IF d->>'startedAt' IS NOT NULL THEN RAISE EXCEPTION 'Assignments are fixed after start' USING ERRCODE='22023'; END IF;
   setup:=p_command->'setup'; d:=public.interview_setup_data(setup,r.created_by,(d->>'createdAt')::timestamptz);
   r.interview_id:=(setup->>'interviewId')::uuid;
   r.tutor_ids:=ARRAY(SELECT (value->>'tutorId')::uuid FROM jsonb_array_elements(setup->'assignments'));
   r.student_ids:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(setup->'studentIds')); changed:=true;
  ELSIF kind='start' THEN
   IF d->>'startedAt' IS NOT NULL THEN RAISE EXCEPTION 'Round already started' USING ERRCODE='22023'; END IF;
   d:=public.interview_setup_data(d,r.created_by,(d->>'createdAt')::timestamptz) || jsonb_build_object('startedAt',now()); changed:=true;
  ELSIF kind='ready' THEN
   IF idx IS NULL OR d->>'phase'<>'waiting' OR d->>'startedAt' IS NULL THEN RAISE EXCEPTION 'Cannot change readiness now' USING ERRCODE='22023'; END IF;
   d:=jsonb_set(d,ARRAY['progress',idx::text,'ready'],to_jsonb(coalesce((p_command->>'ready')::boolean,false))); changed:=true;
  ELSIF kind='startReading' THEN
   IF d->>'startedAt' IS NULL OR d->>'phase'<>'waiting' OR d->>'pausedAt' IS NOT NULL
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE NOT (p->>'ready')::boolean)
    THEN RAISE EXCEPTION 'Every tutor must be ready' USING ERRCODE='22023'; END IF;
   IF d->>'delivery'='online' AND NOT coalesce((p_command->>'overrideMissingStudents')::boolean,false)
    AND EXISTS(SELECT 1 FROM unnest(r.student_ids) s WHERE NOT EXISTS(SELECT 1 FROM public.interview_presence WHERE round_id=r.id AND student_id=s AND last_seen_at>now()-interval '20 seconds'))
    THEN RAISE EXCEPTION 'Students are disconnected; explicit override required' USING ERRCODE='22023'; END IF;
   d:=d || jsonb_build_object('phase','reading','phaseStartedAt',now(),'phaseDeadline',now()+make_interval(secs=>(d->>'readingTimeSeconds')::integer)); changed:=true;
  ELSIF kind='pause' THEN
   IF d->>'pausedAt' IS NOT NULL OR d->>'phase'='completed' OR d->>'startedAt' IS NULL THEN RAISE EXCEPTION 'Cannot pause now' USING ERRCODE='22023'; END IF;
   d:=d || jsonb_build_object('pausedAt',now(),'remainingMilliseconds',greatest(0,extract(epoch FROM ((d->>'phaseDeadline')::timestamptz-now()))*1000)); changed:=true;
  ELSIF kind='resume' THEN
   IF d->>'pausedAt' IS NULL THEN RAISE EXCEPTION 'Round is not paused' USING ERRCODE='22023'; END IF;
   d:=d || jsonb_build_object('phaseDeadline',CASE WHEN d->>'phaseDeadline' IS NOT NULL THEN now()+make_interval(secs=>(d->>'remainingMilliseconds')::double precision/1000) ELSE NULL END,
    'phaseStartedAt',(d->>'phaseStartedAt')::timestamptz + (now()-(d->>'pausedAt')::timestamptz),'pausedAt',NULL,'remainingMilliseconds',NULL); changed:=true;
  ELSIF kind IN ('endStation','finishFeedback') THEN
   IF idx IS NULL OR d->>'phase' NOT IN ('questions','feedback') OR d->>'pausedAt' IS NOT NULL THEN RAISE EXCEPTION 'Station cannot finish now' USING ERRCODE='22023'; END IF;
   IF kind='endStation' THEN
    d:=jsonb_set(d,ARRAY['progress',idx::text,'endedEarly'],'true');
   ELSE
    IF d->>'phase'='questions' AND NOT (progress->>'endedEarly')::boolean THEN RAISE EXCEPTION 'End the station before finishing feedback' USING ERRCODE='22023'; END IF;
    d:=jsonb_set(d,ARRAY['progress',idx::text,'feedbackComplete'],'true');
    SELECT (ordinality-1)::integer INTO attempt_idx FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY a
     WHERE a.value->>'stationId'=progress->>'stationId' AND a.value->>'studentId'=progress->>'studentId';
    IF attempt_idx IS NOT NULL THEN d:=jsonb_set(d,ARRAY['attempts',attempt_idx::text,'completed'],'true'); END IF;
   END IF; changed:=true;
  ELSIF kind='next' THEN
   IF d->>'phase' NOT IN ('questions','feedback') OR d->>'pausedAt' IS NOT NULL
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE p->>'studentId' IS NOT NULL AND NOT (p->>'feedbackComplete')::boolean)
    THEN RAISE EXCEPTION 'Every station must finish feedback' USING ERRCODE='22023'; END IF;
   IF (d->>'rotation')::integer+1>=jsonb_array_length(d->'stations') THEN
    d:=d || jsonb_build_object('phase','completed','phaseDeadline',NULL,'phaseStartedAt',now(),'stations',public.interview_round_json(r)->'stations');
   ELSE
    d:=d || jsonb_build_object('rotation',(d->>'rotation')::integer+1,'phase','waiting','phaseDeadline',NULL,'phaseStartedAt',now());
    SELECT jsonb_agg(p.value || jsonb_build_object('ready',false,'endedEarly',false,'feedbackComplete',false,'studentId',
      CASE WHEN d->>'delivery'='online' THEN to_jsonb(r.student_ids[((p.ordinality-1-(d->>'rotation')::integer+jsonb_array_length(d->'stations')) % jsonb_array_length(d->'stations'))+1]) ELSE 'null'::jsonb END) ORDER BY p.ordinality)
     INTO item FROM jsonb_array_elements(d->'progress') WITH ORDINALITY p;
    d:=jsonb_set(d,'{progress}',item);
   END IF; changed:=true;
  ELSIF kind='claimStudent' THEN
   IF idx IS NULL OR d->>'delivery'<>'in_person' OR d->>'phase' NOT IN ('waiting','reading','questions') THEN RAISE EXCEPTION 'Cannot select a student now' USING ERRCODE='22023'; END IF;
   selected:=(p_command->>'studentId')::uuid;
   IF selected IS NOT NULL AND (NOT(selected=ANY(r.student_ids)) OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE p->>'studentId'=selected::text AND p->>'stationId'<>progress->>'stationId'))
    THEN RAISE EXCEPTION 'Student is already at another station or not in this round' USING ERRCODE='22023'; END IF;
   SELECT value,(ordinality-1)::integer INTO old_attempt,old_idx FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY WHERE value->>'stationId'=progress->>'stationId' AND value->>'studentId'=progress->>'studentId';
   SELECT value,(ordinality-1)::integer INTO target_attempt,target_idx FROM jsonb_array_elements(d->'attempts') WITH ORDINALITY WHERE value->>'stationId'=progress->>'stationId' AND value->>'studentId'=selected::text;
   IF selected::text IS DISTINCT FROM progress->>'studentId' THEN
    IF coalesce((target_attempt->>'completed')::boolean,false) THEN RAISE EXCEPTION 'Student has already completed this station' USING ERRCODE='22023'; END IF;
    IF old_attempt->>'score' IS NOT NULL OR old_attempt->>'notAssessedReason' IS NOT NULL OR jsonb_array_length(coalesce(old_attempt->'feedback','[]'))>0 OR EXISTS(SELECT 1 FROM public.interview_recordings WHERE round_id=r.id AND attempt_id=(old_attempt->>'id')::uuid) THEN
     IF NOT coalesce((p_command->>'confirmMove')::boolean,false) OR selected IS NULL THEN RAISE EXCEPTION 'Confirm moving existing feedback and score' USING ERRCODE='22023'; END IF;
     IF target_attempt->>'score' IS NOT NULL OR target_attempt->>'notAssessedReason' IS NOT NULL OR jsonb_array_length(target_attempt->'feedback')>0 OR EXISTS(SELECT 1 FROM public.interview_recordings WHERE round_id=r.id AND attempt_id=(target_attempt->>'id')::uuid) THEN RAISE EXCEPTION 'Target student already has assessment entries' USING ERRCODE='22023'; END IF;
     d:=jsonb_set(d,ARRAY['attempts',target_idx::text],target_attempt || jsonb_build_object('score',old_attempt->'score','notAssessedReason',old_attempt->'notAssessedReason','feedback',old_attempt->'feedback','version',(target_attempt->>'version')::integer+1,'updatedAt',now(),'updatedBy',actor));
     d:=jsonb_set(d,ARRAY['attempts',old_idx::text],old_attempt || jsonb_build_object('score',NULL,'notAssessedReason',NULL,'feedback','[]'::jsonb,'version',(old_attempt->>'version')::integer+1,'updatedAt',now(),'updatedBy',actor));
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
   d:=jsonb_set(d,ARRAY['attempts',attempt_idx::text],attempt || jsonb_build_object('score',p_command->'score','notAssessedReason',p_command->'notAssessedReason','feedback',p_command->'feedback','completed',CASE WHEN d->>'phase'='completed' AND p_command->>'score' IS NOT NULL THEN true ELSE (attempt->>'completed')::boolean END,'version',ver,'updatedAt',now(),'updatedBy',actor)); changed:=true;
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

ALTER TABLE public.interview_questions DROP COLUMN category_id, DROP COLUMN prompt;
