-- DEV-8: bank/templates and a transactional round aggregate. Browser access is
-- exclusively through actor-scoped views; command RPCs are server-only.
CREATE TABLE public.interview_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (btrim(name) <> ''),
  parent_id uuid REFERENCES public.interview_categories(id), CHECK (parent_id IS DISTINCT FROM id)
);
CREATE TABLE public.interview_tags (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (btrim(name) <> ''));
CREATE TABLE public.interview_questions (
  id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1,
  category_id uuid NOT NULL REFERENCES public.interview_categories(id), tag_ids uuid[] NOT NULL DEFAULT '{}',
  question jsonb NOT NULL, prompt jsonb NOT NULL, rubric jsonb NOT NULL,
  rubric_version integer NOT NULL DEFAULT 1, suggested_time_seconds integer NOT NULL DEFAULT 120 CHECK (suggested_time_seconds > 0),
  archived boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.interview_rubric_revisions (
  question_id uuid NOT NULL REFERENCES public.interview_questions(id), version integer NOT NULL,
  rubric jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES public.staff(id), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, version)
);
CREATE TABLE public.interviews (
  id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.interview_rounds (
  id uuid PRIMARY KEY, interview_id uuid NOT NULL REFERENCES public.interviews(id),
  created_by uuid NOT NULL REFERENCES public.staff(id), tutor_ids uuid[] NOT NULL, student_ids uuid[] NOT NULL,
  version integer NOT NULL DEFAULT 1, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
-- Current projection and immutable publication history are separate: drafting
-- and re-releasing a correction never rewrites an earlier published snapshot.
CREATE TABLE public.interview_result_releases (
 round_id uuid NOT NULL REFERENCES public.interview_rounds(id),
 student_id uuid NOT NULL REFERENCES public.students(id), revision integer NOT NULL CHECK (revision>0),
 snapshot jsonb NOT NULL, released_by uuid NOT NULL REFERENCES public.staff(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(round_id,student_id,revision)
);
CREATE INDEX interview_rounds_tutors ON public.interview_rounds USING gin(tutor_ids);
CREATE INDEX interview_rounds_students ON public.interview_rounds USING gin(student_ids);
CREATE TABLE public.interview_command_receipts (
  actor_user_id uuid NOT NULL, command_id uuid NOT NULL, command jsonb NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_user_id, command_id)
);
CREATE TABLE public.interview_presence (
  round_id uuid NOT NULL REFERENCES public.interview_rounds(id), student_id uuid NOT NULL REFERENCES public.students(id),
  last_seen_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(round_id, student_id)
);
CREATE TABLE public.interview_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), round_id uuid NOT NULL REFERENCES public.interview_rounds(id),
  attempt_id uuid NOT NULL, capture_id uuid, provider_id text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('pending','recording','ready','failed','expired')),
  kind text NOT NULL CHECK (kind IN ('audio','video')), storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days',
  expiry_retry_at timestamptz NOT NULL DEFAULT now(), expiry_error text
);

CREATE FUNCTION public.interview_tutor_id(p_user_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT st.id FROM public.staff st WHERE st.user_id = p_user_id AND st.status IN ('ACTIVE','TRIAL')
 AND EXISTS (SELECT 1 FROM public.subjects sub WHERE lower(btrim(sub.name)) = 'medicine interview'
 AND (EXISTS (SELECT 1 FROM public.staff_subjects ss WHERE ss.staff_id=st.id AND ss.subject_id=sub.id)
 OR EXISTS (SELECT 1 FROM public.classes_staff cs JOIN public.classes c ON c.id=cs.class_id
 WHERE cs.staff_id=st.id AND cs.unassigned_at IS NULL AND c.subject_id=sub.id))) LIMIT 1;
$$;
CREATE FUNCTION public.interview_student_has_access(p_student_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.students s JOIN public.classes_students cs ON cs.student_id=s.id
 JOIN public.classes c ON c.id=cs.class_id JOIN public.subjects sub ON sub.id=c.subject_id
 WHERE s.id=p_student_id AND s.status IN ('ACTIVE','TRIAL') AND cs.enrolled_at <= now()
 AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > now()) AND lower(btrim(sub.name))='medicine interview');
$$;
CREATE FUNCTION public.interview_question_json(q public.interview_questions) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
 SELECT jsonb_build_object('id',q.id,'version',q.version,'categoryId',q.category_id,'tagIds',q.tag_ids,
 'question',q.question,'prompt',q.prompt,'rubric',q.rubric,'rubricVersion',q.rubric_version,
 'suggestedTimeSeconds',q.suggested_time_seconds,'archived',q.archived,'updatedAt',q.updated_at);
$$;
-- Advance by absolute server deadlines, not browser timers. A late observer can
-- cross both deadlines without extending a student's answer time.
CREATE FUNCTION public.interview_effective_state(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE d jsonb := p_data; deadline timestamptz;
BEGIN
 IF d->>'pausedAt' IS NOT NULL THEN RETURN d; END IF;
 deadline := (d->>'phaseDeadline')::timestamptz;
 IF d->>'phase'='reading' AND deadline <= now() THEN
   d := d || jsonb_build_object('phase','questions','phaseStartedAt',deadline,
    'phaseDeadline',deadline + make_interval(secs => (d->>'questionTimeSeconds')::integer));
   deadline := (d->>'phaseDeadline')::timestamptz;
 END IF;
 IF d->>'phase'='questions' AND deadline <= now() THEN
   d := d || jsonb_build_object('phase','feedback','phaseStartedAt',deadline,'phaseDeadline',NULL);
 END IF;
 RETURN d;
END;
$$;
CREATE FUNCTION public.interview_recording_json(r public.interview_recordings) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT jsonb_build_object('id',r.id,'attemptId',r.attempt_id,'state',CASE WHEN r.expires_at<=now() THEN 'expired' ELSE r.state END,
 'kind',r.kind,'createdAt',r.created_at,'expiresAt',r.expires_at);
$$;
CREATE FUNCTION public.interview_round_json(r public.interview_rounds) RETURNS jsonb
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
   (SELECT coalesce(jsonb_agg(p.value || jsonb_build_object('rubric',q.rubric,'rubricVersion',q.rubric_version) ORDER BY p.ordinality),'[]')
    FROM jsonb_array_elements(s.value->'questions') WITH ORDINALITY p
    JOIN public.interview_questions q ON q.id=(p.value->>'questionId')::uuid)) ORDER BY s.ordinality),'[]')
 INTO stations FROM jsonb_array_elements(d->'stations') WITH ORDINALITY s;
 END IF;
 RETURN d || jsonb_build_object('id',r.id,'version',r.version,'updatedAt',r.updated_at,'stations',stations,'serverNow',now(),
  'connectedStudentIds',(SELECT coalesce(jsonb_agg(student_id),'[]') FROM public.interview_presence
    WHERE round_id=r.id AND last_seen_at > now()-interval '20 seconds'),
  'recordings',(SELECT coalesce(jsonb_agg(public.interview_recording_json(rec) ORDER BY rec.created_at),'[]') FROM public.interview_recordings rec WHERE rec.round_id=r.id AND NOT (rec.id IS NOT DISTINCT FROM rec.capture_id AND EXISTS(SELECT 1 FROM public.interview_recordings child WHERE child.capture_id=rec.id AND child.id<>rec.id))));
END;
$$;

CREATE VIEW public.vtutor_interview_catalog WITH (security_invoker=false) AS
SELECT jsonb_build_object('actorId',public.interview_tutor_id((select auth.uid())),
 'categories',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'parentId',parent_id) ORDER BY name),'[]') FROM public.interview_categories),
 'tags',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name),'[]') FROM public.interview_tags),
 'questions',(SELECT coalesce(jsonb_agg(public.interview_question_json(q) ORDER BY updated_at DESC),'[]') FROM public.interview_questions q),
 'interviews',(SELECT coalesce(jsonb_agg(data || jsonb_build_object('id',id,'version',version,'updatedAt',updated_at) ORDER BY updated_at DESC),'[]') FROM public.interviews),
 'tutors',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',first_name||' '||last_name) ORDER BY first_name),'[]') FROM public.staff WHERE public.interview_tutor_id(user_id)=id),
 'students',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name,'classIds',
    (SELECT coalesce(jsonb_agg(cs.class_id),'[]') FROM public.classes_students cs JOIN public.classes c ON c.id=cs.class_id JOIN public.subjects sub ON sub.id=c.subject_id
     WHERE cs.student_id=s.id AND cs.enrolled_at<=now() AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at>now()) AND lower(btrim(sub.name))='medicine interview')) ORDER BY s.first_name),'[]')
     FROM public.students s WHERE public.interview_student_has_access(s.id)),
 'classes',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',coalesce(c.long_name,c.short_name,'Interview class')) ORDER BY c.long_name),'[]') FROM public.classes c JOIN public.subjects sub ON sub.id=c.subject_id WHERE lower(btrim(sub.name))='medicine interview')) AS data
WHERE public.interview_tutor_id((select auth.uid())) IS NOT NULL;
CREATE VIEW public.vtutor_interview_rounds WITH (security_invoker=false) AS
SELECT r.id,public.interview_round_json(r) AS data FROM public.interview_rounds r
WHERE public.interview_tutor_id((select auth.uid())) = ANY(r.tutor_ids)
 OR public.interview_tutor_id((select auth.uid())) = r.created_by;
CREATE VIEW public.vstudent_interview_access WITH (security_invoker=false) AS
SELECT public.current_student_id() AS student_id, public.interview_student_has_access(public.current_student_id()) AS has_access
WHERE (select auth.uid()) IS NOT NULL;
CREATE FUNCTION public.interview_student_round_json(r public.interview_rounds,p_student_id uuid) RETURNS jsonb
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
  SELECT jsonb_agg(jsonb_build_object('id',s.value->'id','name','','maximumPoints',s.value->'maximumPoints','questions',
   (SELECT jsonb_agg(p.value - 'rubric' - 'rubricVersion' || jsonb_build_object('rubric',NULL,'rubricVersion',0) ORDER BY p.ordinality)
    FROM jsonb_array_elements(s.value->'questions') WITH ORDINALITY p)) ORDER BY s.ordinality)
  INTO result_stations FROM jsonb_array_elements(d->'stations') WITH ORDINALITY s;
 END IF;
 RETURN jsonb_build_object('id',r.id,'version',r.version,'name',d->'name','delivery',d->'delivery','mode',d->'mode','recordingEnabled',d->'recordingEnabled',
  'scheduledAt',d->'scheduledAt','startedAt',d->'startedAt','phase',d->'phase','rotation',d->'rotation','pausedAt',d->'pausedAt',
  'phaseStartedAt',d->'phaseStartedAt','phaseDeadline',CASE WHEN d->>'phase'='reading' THEN d->'phaseDeadline' ELSE 'null'::jsonb END,'serverNow',now(),
  'studentId',p_student_id,'stationId',progress->'stationId','stationNumber',station_number,
  'tutor',(SELECT value FROM jsonb_array_elements(d->'tutors') WHERE value->>'id'=progress->>'tutorId'),
  'prompt',CASE WHEN d->>'phase' IN ('reading','questions','feedback') THEN station->'questions'->0->'prompt' ELSE 'null'::jsonb END,
  'endedEarly',coalesce(progress->'endedEarly','false'),
  'stations',(SELECT jsonb_agg(jsonb_build_object('id',s.value->'id','number',s.ordinality,'complete',EXISTS(
     SELECT 1 FROM jsonb_array_elements(d->'attempts') a WHERE a->>'studentId'=p_student_id::text AND a->>'stationId'=s.value->>'id' AND (a->>'completed')::boolean)) ORDER BY s.ordinality)
     FROM jsonb_array_elements(d->'stations') WITH ORDINALITY s), 'result',result,'resultStations',coalesce(result_stations,'[]'));
END;
$$;
CREATE VIEW public.vstudent_interview_rounds WITH (security_invoker=false) AS
SELECT r.id,public.interview_student_round_json(r,public.current_student_id()) AS data FROM public.interview_rounds r
WHERE public.current_student_id()=ANY(r.student_ids) AND public.interview_student_has_access(public.current_student_id());

-- Validate template structure and references once at the write boundary. Repeated
-- bank questions are allowed; placement IDs, unlike bank IDs, are unique.
CREATE FUNCTION public.interview_validate_template(d jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE s jsonb; p jsonb; ids uuid[]:='{}'; station_ids uuid[]:='{}';
BEGIN
 IF btrim(coalesce(d->>'name',''))='' OR (d->>'readingTimeSeconds')::integer NOT BETWEEN 1 AND 3600
 OR d->>'readingTimeSeconds' IS NULL OR d->>'questionTimeSeconds' IS NULL OR (d->>'questionTimeSeconds')::integer NOT BETWEEN 1 AND 7200 OR jsonb_typeof(d->'stations') IS DISTINCT FROM 'array'
 OR jsonb_array_length(d->'stations')>6 THEN RAISE EXCEPTION 'Invalid interview details' USING ERRCODE='22023'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(d->'stations') LOOP
  IF (s->>'id')::uuid IS NULL OR (s->>'id')::uuid=ANY(station_ids) OR btrim(coalesce(s->>'name',''))=''
   OR (s->>'maximumPoints')::numeric IS NULL OR (s->>'maximumPoints')::numeric<=0 OR (s->>'maximumPoints')::numeric>1000
   OR jsonb_typeof(s->'questions') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid station' USING ERRCODE='22023'; END IF;
  station_ids:=array_append(station_ids,(s->>'id')::uuid);
  FOR p IN SELECT value FROM jsonb_array_elements(s->'questions') LOOP
   IF (p->>'id')::uuid IS NULL OR (p->>'id')::uuid=ANY(ids) OR NOT EXISTS(SELECT 1 FROM public.interview_questions WHERE id=(p->>'questionId')::uuid)
   THEN RAISE EXCEPTION 'Invalid question placement' USING ERRCODE='22023'; END IF;
   ids:=array_append(ids,(p->>'id')::uuid);
  END LOOP;
 END LOOP;
END;
$$;
CREATE FUNCTION public.interview_setup_data(p_setup jsonb,p_actor uuid,p_created_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE template jsonb; stations jsonb; progress jsonb; attempts jsonb; selected_students uuid[]; tutors uuid[]; station_count integer;
BEGIN
 SELECT data INTO template FROM public.interviews WHERE id=(p_setup->>'interviewId')::uuid;
 IF template IS NULL OR coalesce((template->>'archived')::boolean,false) THEN RAISE EXCEPTION 'Interview unavailable' USING ERRCODE='22023'; END IF;
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
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(template->'stations') s WHERE jsonb_array_length(s->'questions')=0)
 THEN RAISE EXCEPTION 'Invalid round participants or stations' USING ERRCODE='22023'; END IF;
 IF p_setup->>'scheduledAt' IS NOT NULL THEN PERFORM (p_setup->>'scheduledAt')::timestamptz; END IF;
 SELECT jsonb_agg(s.value || jsonb_build_object('questions',
   (SELECT jsonb_agg(p.value || jsonb_build_object('question',q.question,'prompt',q.prompt,'rubric',q.rubric,'rubricVersion',q.rubric_version) ORDER BY p.ordinality)
    FROM jsonb_array_elements(s.value->'questions') WITH ORDINALITY p JOIN public.interview_questions q ON q.id=(p.value->>'questionId')::uuid)) ORDER BY s.ordinality)
 INTO stations FROM jsonb_array_elements(template->'stations') WITH ORDINALITY s;
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
CREATE FUNCTION public.interview_command(p_actor_user_id uuid,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 kind text:=p_command->>'type'; actor uuid:=public.interview_tutor_id(p_actor_user_id); student uuid;
 v_command_id uuid:=(p_command->>'commandId')::uuid; receipt public.interview_command_receipts;
 entity_id uuid; expected integer:=(p_command->>'expectedVersion')::integer; q public.interview_questions; t public.interviews; r public.interview_rounds;
 d jsonb; item jsonb; progress jsonb; station jsonb; attempt jsonb; target_attempt jsonb; old_attempt jsonb;
 idx integer; target_idx integer; attempt_idx integer; old_idx integer; result jsonb; ver integer; setup jsonb; selected uuid; changed boolean:=true;
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
 ELSIF kind IN ('saveQuestion','saveRubric') THEN
  item:=p_command->'question'; entity_id:=coalesce((item->>'id')::uuid,(p_command->>'questionId')::uuid);
  PERFORM pg_advisory_xact_lock(hashtextextended(entity_id::text,1));
  SELECT * INTO q FROM public.interview_questions WHERE id=entity_id FOR UPDATE;
  IF expected IS DISTINCT FROM (CASE WHEN kind='saveRubric' THEN coalesce(q.rubric_version,0) ELSE coalesce(q.version,0) END) THEN RAISE EXCEPTION 'Question changed; reload before saving' USING ERRCODE='PT409'; END IF;
  IF kind='saveRubric' THEN
   IF q.id IS NULL THEN RAISE EXCEPTION 'Question not found' USING ERRCODE='22023'; END IF;
   item:=public.interview_question_json(q) || jsonb_build_object('rubric',p_command->'rubric');
  END IF;
  IF jsonb_typeof(item->'tagIds') IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(item->'tagIds') x WHERE NOT EXISTS(SELECT 1 FROM public.interview_tags WHERE id=x::uuid))
   OR item->'question' IS NULL OR item->'prompt' IS NULL OR item->'rubric' IS NULL THEN RAISE EXCEPTION 'Invalid question' USING ERRCODE='22023'; END IF;
  ver:=coalesce(q.version,0)+1;
  INSERT INTO public.interview_questions(id,version,category_id,tag_ids,question,prompt,rubric,rubric_version,suggested_time_seconds,archived)
  VALUES(entity_id,ver,(item->>'categoryId')::uuid,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(item->'tagIds')),
   item->'question',item->'prompt',item->'rubric',coalesce(q.rubric_version,0)+CASE WHEN q.rubric IS DISTINCT FROM item->'rubric' THEN 1 ELSE 0 END,
   (item->>'suggestedTimeSeconds')::integer,coalesce((item->>'archived')::boolean,false))
  ON CONFLICT(id) DO UPDATE SET version=excluded.version,category_id=excluded.category_id,tag_ids=excluded.tag_ids,question=excluded.question,
   prompt=excluded.prompt,rubric=excluded.rubric,rubric_version=excluded.rubric_version,suggested_time_seconds=excluded.suggested_time_seconds,archived=excluded.archived,updated_at=now()
  RETURNING * INTO q;
  IF NOT EXISTS(SELECT 1 FROM public.interview_rubric_revisions WHERE question_id=q.id AND version=q.rubric_version) THEN
   INSERT INTO public.interview_rubric_revisions(question_id,version,rubric,actor_id) VALUES(q.id,q.rubric_version,q.rubric,actor);
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
-- Server-side media reconcilers obtain authoritative state and register provider
-- segments here. Provider IDs and storage paths never appear in student views.
CREATE FUNCTION public.interview_media_state(p_round_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.interview_round_json(r) FROM public.interview_rounds r WHERE id=p_round_id;
$$;
CREATE FUNCTION public.interview_recording_update(p_round_id uuid,p_attempt_id uuid,p_provider_id text,p_state text,p_kind text,p_storage_path text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.interview_rounds; result uuid;
BEGIN
 SELECT * INTO r FROM public.interview_rounds WHERE id=p_round_id FOR UPDATE;
 IF r.id IS NULL OR NOT coalesce((r.data->>'recordingEnabled')::boolean,false)
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.data->'attempts') a WHERE a->>'id'=p_attempt_id::text)
  THEN RAISE EXCEPTION 'Invalid recording attempt' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.interview_recordings WHERE provider_id=p_provider_id AND (round_id<>p_round_id OR attempt_id<>p_attempt_id))
  THEN RAISE EXCEPTION 'Provider recording belongs to another attempt' USING ERRCODE='22023'; END IF;
 INSERT INTO public.interview_recordings(round_id,attempt_id,provider_id,state,kind,storage_path)
 VALUES(p_round_id,p_attempt_id,p_provider_id,p_state,p_kind,p_storage_path)
 ON CONFLICT(provider_id) DO UPDATE SET state=excluded.state,storage_path=coalesce(excluded.storage_path,interview_recordings.storage_path)
 RETURNING id INTO result;
 RETURN result;
END;
$$;

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['interview_categories','interview_tags','interview_questions','interview_rubric_revisions','interviews','interview_rounds','interview_command_receipts','interview_presence','interview_recordings','interview_result_releases'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY admin_access ON public.%I FOR ALL TO authenticated USING ((select public.is_adminstaff_active())) WITH CHECK ((select public.is_adminstaff_active()))',t);
 END LOOP;
END;
$$;
REVOKE ALL ON public.interview_categories,
 public.interview_tags,
 public.interview_questions,
 public.interview_rubric_revisions,
 public.interviews,
 public.interview_rounds,
 public.interview_command_receipts,
 public.interview_presence,
 public.interview_recordings,
 public.interview_result_releases FROM anon,authenticated;
GRANT ALL ON public.interview_categories,
 public.interview_tags,
 public.interview_questions,
 public.interview_rubric_revisions,
 public.interviews,
 public.interview_rounds,
 public.interview_command_receipts,
 public.interview_presence,
 public.interview_recordings,
 public.interview_result_releases TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.interview_categories,
 public.interview_tags,
 public.interview_questions,
 public.interview_rubric_revisions,
 public.interviews,
 public.interview_rounds,
 public.interview_command_receipts,
 public.interview_presence,
 public.interview_recordings,
 public.interview_result_releases TO authenticated;
REVOKE ALL ON FUNCTION public.interview_tutor_id(uuid),
 public.interview_student_has_access(uuid),
 public.interview_question_json(public.interview_questions),
 public.interview_effective_state(jsonb),
 public.interview_recording_json(public.interview_recordings),
 public.interview_round_json(public.interview_rounds),
 public.interview_student_round_json(public.interview_rounds,uuid),
 public.interview_validate_template(jsonb),
 public.interview_setup_data(jsonb,uuid,timestamptz),
 public.interview_command(uuid,jsonb),
 public.interview_media_state(uuid),
 public.interview_recording_update(uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.interview_tutor_id(uuid),
 public.interview_student_has_access(uuid),
 public.interview_question_json(public.interview_questions),
 public.interview_effective_state(jsonb),
 public.interview_recording_json(public.interview_recordings),
 public.interview_round_json(public.interview_rounds),
 public.interview_student_round_json(public.interview_rounds,uuid),
 public.interview_validate_template(jsonb),
 public.interview_setup_data(jsonb,uuid,timestamptz),
 public.interview_command(uuid,jsonb),
 public.interview_media_state(uuid),
 public.interview_recording_update(uuid,uuid,text,text,text,text) TO service_role;
-- Only scoped helpers needed by views are executable by signed-in users. A user
-- cannot choose an actor for a command; API routes supply the verified auth ID.
GRANT EXECUTE ON FUNCTION public.interview_tutor_id(uuid),public.interview_student_has_access(uuid),public.interview_question_json(public.interview_questions),public.interview_round_json(public.interview_rounds),public.interview_student_round_json(public.interview_rounds,uuid) TO authenticated;
GRANT SELECT ON public.vtutor_interview_catalog,public.vtutor_interview_rounds,public.vstudent_interview_access,public.vstudent_interview_rounds TO authenticated;

CREATE FUNCTION public.interview_can_receive_round(p_round_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.interview_rounds r WHERE r.id=p_round_id AND
  (public.interview_tutor_id((select auth.uid()))=ANY(r.tutor_ids) OR public.interview_tutor_id((select auth.uid()))=r.created_by
   OR (public.current_student_id()=ANY(r.student_ids) AND public.interview_student_has_access(public.current_student_id()))));
$$;
REVOKE ALL ON FUNCTION public.interview_can_receive_round(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.interview_can_receive_round(uuid) TO authenticated,service_role;
CREATE FUNCTION public.interview_broadcast_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM realtime.send(jsonb_build_object('id',NEW.id,'version',NEW.version),'changed','interview-round:'||NEW.id,true);
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.interview_broadcast_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER interview_round_changed AFTER INSERT OR UPDATE ON public.interview_rounds
FOR EACH ROW EXECUTE FUNCTION public.interview_broadcast_change();
-- realtime.messages is owned by supabase_realtime_admin. Its private-channel
-- policy is provisioned by the deployment owner, as for the iMessage connector.
-- Polling/focus/reconnect reads remain the recovery path if Broadcast is absent.

CREATE VIEW public.vtutor_interview_access WITH (security_invoker=false) AS
SELECT public.interview_tutor_id((select auth.uid())) AS tutor_id,
 public.interview_tutor_id((select auth.uid())) IS NOT NULL AS has_access
WHERE (select auth.uid()) IS NOT NULL;
REVOKE ALL ON public.vtutor_interview_access,public.vstudent_interview_access,public.vtutor_interview_catalog,public.vtutor_interview_rounds,public.vstudent_interview_rounds FROM anon;
GRANT SELECT ON public.vtutor_interview_access TO authenticated;

CREATE VIEW public.vtutor_interview_result_releases WITH (security_invoker=false) AS
SELECT h.round_id,h.student_id,h.revision,h.snapshot,h.released_by,h.created_at
FROM public.interview_result_releases h JOIN public.interview_rounds r ON r.id=h.round_id
WHERE public.interview_tutor_id((select auth.uid()))=ANY(r.tutor_ids)
 OR public.interview_tutor_id((select auth.uid()))=r.created_by;
REVOKE ALL ON public.vtutor_interview_result_releases FROM anon;
GRANT SELECT ON public.vtutor_interview_result_releases TO authenticated;
CREATE FUNCTION public.interview_prevent_release_rewrite() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'Published interview revisions are immutable' USING ERRCODE='55000';
END;
$$;
REVOKE ALL ON FUNCTION public.interview_prevent_release_rewrite() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER interview_result_release_immutable BEFORE UPDATE OR DELETE ON public.interview_result_releases
FOR EACH ROW EXECUTE FUNCTION public.interview_prevent_release_rewrite();
