BEGIN;
SELECT no_plan();
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011') AND sub.name='Medicine Interview' ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
CREATE FUNCTION pg_temp.cmd(p jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.interview_command('00000000-0000-0000-0000-000000000010',jsonb_build_object('commandId',gen_random_uuid())||p);
$$;
SELECT pg_temp.cmd('{"type":"saveCategory","category":{"id":"e8260000-0000-4000-8000-000000000001","name":"Ethics","parentId":null}}');
SELECT pg_temp.cmd('{"type":"saveTag","tag":{"id":"e8260000-0000-4000-8000-000000000002","name":"Reflection"}}');
SELECT pg_temp.cmd('{"type":"saveTag","tag":{"id":"e8260000-0000-4000-8000-000000000003","name":"Communication"}}');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveStation","expectedVersion":0,"station":{"id":"e8260000-0000-4000-8000-000000000010","name":"Hospital follow-up","categoryId":"e8260000-0000-4000-8000-000000000001","prompt":"A patient misunderstood the hospital instructions.","maximumPoints":6.5,"archived":false,"questions":[{"id":"e8260000-0000-4000-8000-000000000011","stationId":"e8260000-0000-4000-8000-000000000010","question":"What are the issues?","tagIds":["e8260000-0000-4000-8000-000000000002","e8260000-0000-4000-8000-000000000003"],"rubric":"Discuss the misunderstanding","suggestedTimeSeconds":90},{"id":"e8260000-0000-4000-8000-000000000012","stationId":"e8260000-0000-4000-8000-000000000010","question":"How could this be prevented?","tagIds":[],"rubric":"Consider follow-up","suggestedTimeSeconds":120}]}}')$q$,'Station editor saves a whole scenario and its linked questions');
CREATE FUNCTION pg_temp.station() RETURNS jsonb LANGUAGE sql AS $$
 SELECT s FROM public.vtutor_interview_catalog c CROSS JOIN jsonb_array_elements(c.data->'stations') s WHERE s->>'id'='e8260000-0000-4000-8000-000000000010';
$$;
CREATE FUNCTION pg_temp.save_station(patch jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT pg_temp.cmd(jsonb_build_object('type','saveStation','expectedVersion',pg_temp.station()->'version','station',pg_temp.station()||patch));
$$;
SELECT is(pg_temp.station()->>'categoryId','e8260000-0000-4000-8000-000000000001','Category belongs to the station');
SELECT ok(NOT (pg_temp.station() ? 'tagIds'),'Station has no independently assigned tags');
SELECT ok(NOT (pg_temp.station()->'questions'->0 ? 'categoryId'),'Question has no independent category');
SELECT is(jsonb_array_length(pg_temp.station()->'questions'->0->'tagIds'),2,'One question can carry multiple tags');
SELECT is(jsonb_array_length(pg_temp.station()->'questions'->1->'tagIds'),0,'Other questions keep their own independent tags');
SELECT throws_ok($q$SELECT pg_temp.cmd('{"type":"saveQuestion","expectedVersion":0,"question":{}}')$q$,'22023','Questions must be edited through their station','Standalone question writes are rejected');
SELECT throws_ok($q$SELECT pg_temp.save_station('{"questions":[]}')$q$,'22023','Invalid station','Station cannot lose its last question');
SELECT throws_ok($q$SELECT pg_temp.save_station('{"categoryId":null}')$q$,'22023','Invalid station','Station must have exactly one valid category');
SELECT throws_ok($q$SELECT pg_temp.save_station(jsonb_build_object('questions',jsonb_build_array(pg_temp.station()->'questions'->0,pg_temp.station()->'questions'->0)))$q$,'22023','Invalid station question','Duplicating a child identity is rejected atomically');
SELECT is(jsonb_array_length(pg_temp.station()->'questions'),2,'Rejected edit preserves the original complete station');
SELECT throws_ok($q$SELECT pg_temp.cmd(jsonb_build_object('type','saveStation','expectedVersion',0,'station',pg_temp.station() || jsonb_build_object('id','e8260000-0000-4000-8000-000000000020','questions',jsonb_build_array(pg_temp.station()->'questions'->0 || '{"stationId":"e8260000-0000-4000-8000-000000000020"}'::jsonb))))$q$,'22023','Invalid station question','A different station cannot take an existing question identity');
SELECT lives_ok($q$SELECT pg_temp.cmd('{"type":"saveInterview","expectedVersion":0,"interview":{"id":"e8260000-0000-4000-8000-000000000030","name":"Repeated station mock","readingTimeSeconds":60,"questionTimeSeconds":480,"recordingEnabled":false,"archived":false,"stations":[{"id":"e8260000-0000-4000-8000-000000000031","stationId":"e8260000-0000-4000-8000-000000000010"},{"id":"e8260000-0000-4000-8000-000000000032","stationId":"e8260000-0000-4000-8000-000000000010"}]}}')$q$,'Whole stations may repeat as separate occurrences');
SELECT throws_ok($q$SELECT pg_temp.cmd('{"type":"saveInterview","expectedVersion":0,"interview":{"id":"e8260000-0000-4000-8000-000000000033","name":"Override","readingTimeSeconds":60,"questionTimeSeconds":480,"recordingEnabled":false,"archived":false,"stations":[{"id":"e8260000-0000-4000-8000-000000000034","stationId":"e8260000-0000-4000-8000-000000000010","questions":[]}]}}')$q$,'22023','Invalid station placement','Interview cannot override a station question list');
SELECT pg_temp.cmd('{"type":"createRound","roundId":"e8260000-0000-4000-8000-000000000040","setup":{"interviewId":"e8260000-0000-4000-8000-000000000030","name":"Station ownership test","delivery":"online","mode":"exam","recordingEnabled":false,"scheduledAt":null,"studentIds":["10000000-0000-0000-0000-000000000001"],"assignments":[{"stationId":"e8260000-0000-4000-8000-000000000031","tutorId":"00000000-0000-0000-0000-000000000010"},{"stationId":"e8260000-0000-4000-8000-000000000032","tutorId":"00000000-0000-0000-0000-000000000011"}]}}');
SELECT pg_temp.cmd(jsonb_build_object('type','start','roundId','e8260000-0000-4000-8000-000000000040','expectedVersion',(SELECT data->'version' FROM public.vtutor_interview_rounds WHERE id='e8260000-0000-4000-8000-000000000040')));
CREATE FUNCTION pg_temp.round() RETURNS jsonb LANGUAGE sql AS $$
 SELECT data FROM public.vtutor_interview_rounds WHERE id='e8260000-0000-4000-8000-000000000040';
$$;
SELECT is(pg_temp.round()->'stations'->0->>'prompt','A patient misunderstood the hospital instructions.','Round snapshots a station-owned reading prompt');
SELECT is(pg_temp.round()->'stations'->0->'questions'->0->>'suggestedTimeSeconds','90','Round retains recommended question timing');
SELECT is(pg_temp.round()->>'questionTimeSeconds','480','Coordinated phase duration remains independent of question guidance');
SELECT is(jsonb_array_length(pg_temp.round()->'attempts'),2,'Repeated station has separate station attempts');
SELECT ok(pg_temp.round()->'attempts'->0->>'id' <> pg_temp.round()->'attempts'->1->>'id','Repeated station attempts keep distinct identities');
SELECT pg_temp.cmd('{"type":"saveRubric","expectedVersion":1,"stationId":"e8260000-0000-4000-8000-000000000010","questionId":"e8260000-0000-4000-8000-000000000011","rubric":"Live correction"}');
SELECT is(pg_temp.round()->'stations'->1->'questions'->0->>'rubric','Live correction','Live rubric correction reaches repeated station occurrences');
SELECT throws_ok($q$SELECT pg_temp.cmd(jsonb_build_object('type','saveStation','expectedVersion',1,'station',pg_temp.station()))$q$,'PT409','Station changed; reload before saving','Live rubric correction invalidates an older station-editor version');
SELECT pg_temp.save_station(jsonb_build_object('prompt','Revised station prompt','maximumPoints',8,'questions',jsonb_build_array(pg_temp.station()->'questions'->1 || '{"question":"Revised follow-up","suggestedTimeSeconds":180}'::jsonb)));
SELECT is(jsonb_array_length(pg_temp.station()->'questions'),1,'Station editor can remove one owned question');
SELECT is(pg_temp.station()->'questions'->0->>'question','Revised follow-up','Prepared station contains the new ordered wording');
SELECT is(pg_temp.round()->'stations'->0->>'prompt','A patient misunderstood the hospital instructions.','Started round retains its original shared prompt');
SELECT is(pg_temp.round()->'stations'->0->'questions'->1->>'question','How could this be prevented?','Started round retains its original question wording');
SELECT is(pg_temp.round()->'stations'->0->'questions'->1->>'suggestedTimeSeconds','120','Started round retains its original timing guidance');
SELECT is(pg_temp.round()->'stations'->0->>'maximumPoints','6.5','Started round retains its original score maximum');
SELECT is(jsonb_array_length(pg_temp.round()->'stations'->0->'questions'),2,'Removing a bank child does not drop a historical snapshot question');
SELECT pg_temp.cmd('{"type":"saveRubric","expectedVersion":2,"stationId":"e8260000-0000-4000-8000-000000000010","questionId":"e8260000-0000-4000-8000-000000000011","rubric":"Correction to removed live question"}');
SELECT is(pg_temp.round()->'stations'->0->'questions'->0->>'rubric','Correction to removed live question','Retired question identity still supports a live rubric correction');
SET LOCAL ROLE authenticated;
SELECT is(jsonb_array_length(pg_temp.station()->'questions'),1,'Authenticated tutor facade includes the station-owned questions despite base-table RLS');
SELECT is((SELECT count(*) FROM public.interview_stations),0::bigint,'Tutor cannot read station base tables');
SELECT ok(NOT has_function_privilege('authenticated','public.interview_command(uuid,jsonb)','EXECUTE'),'Station commands remain server-only');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is(public.interview_station_json(jsonb_populate_record(NULL::public.interview_stations,'{"id":"e8260000-0000-4000-8000-000000000010"}')),NULL::jsonb,'Student cannot bypass the catalog guard through the station helper');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
