BEGIN;
SELECT no_plan();

-- Reuse the standard interview capability/enrolment fixtures. Only the round
-- membership is relevant here: exercise actual Realtime RLS reads/writes, not
-- the helper function or policy expression in isolation.
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011')
AND sub.name='Medicine Interview' ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
INSERT INTO public.interviews(id,data) VALUES('e8100000-0000-4000-8000-000000000001','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
VALUES('e8100000-0000-4000-8000-000000000002','e8100000-0000-4000-8000-000000000001',
'00000000-0000-0000-0000-000000000010',ARRAY['00000000-0000-0000-0000-000000000010']::uuid[],
ARRAY['10000000-0000-0000-0000-000000000001']::uuid[],'{}');
-- Match the real Realtime authorization probe: it inserts topic/extension
-- without the private field. An event marker only isolates these test rows.
INSERT INTO realtime.messages(topic,event,extension) VALUES
('interview-round:e8100000-0000-4000-8000-000000000002','interview-authorization-probe','broadcast'),
('interview-round:e8100000-0000-4000-8000-000000000099','interview-authorization-probe','broadcast'),
('interview-round:e8100000-0000-4000-8000-000000000002','interview-authorization-probe','presence');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='realtime.messages'::regclass),'Realtime messages retain enabled RLS');
SELECT ok(NOT has_function_privilege('anon','public.interview_can_receive_round(uuid)','EXECUTE'),'Anonymous users do not inherit public execution of the scope helper');
SET LOCAL ROLE authenticated;
SELECT set_config('realtime.topic','interview-round:e8100000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),1::bigint,
'Eligible participating tutor passes the real private-channel probe, excluding other topics and presence');
SELECT throws_ok($q$INSERT INTO realtime.messages(topic,event,payload,extension,private)
VALUES('interview-round:e8100000-0000-4000-8000-000000000002','spoofed-change','{}','broadcast',true)$q$,
'42501',NULL,'Participating tutor cannot publish a private broadcast');

SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),1::bigint,'Currently enrolled selected student receives the private broadcast');
SELECT throws_ok($q$INSERT INTO realtime.messages(topic,event,payload,extension,private)
VALUES('interview-round:e8100000-0000-4000-8000-000000000002','spoofed-change','{}','broadcast',true)$q$,
'42501',NULL,'Selected student cannot publish a private broadcast');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),0::bigint,'Eligible tutor outside the round cannot receive its broadcasts');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),0::bigint,'Interview-enrolled student outside the round cannot receive its broadcasts');
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),0::bigint,'Missing authenticated identity cannot receive broadcasts');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT set_config('realtime.topic','interview-round:not-a-uuid',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),0::bigint,'Malformed interview topic is rejected without a UUID cast error');
SELECT set_config('realtime.topic','other-topic:e8100000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),0::bigint,'Other topic namespaces are not authorized');
SELECT set_config('realtime.topic','interview-round:e8100000-0000-4000-8000-000000000099',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),0::bigint,'Well-formed topic for an unknown round is denied');

RESET ROLE;
UPDATE public.staff SET status='INACTIVE' WHERE id='00000000-0000-0000-0000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('realtime.topic','interview-round:e8100000-0000-4000-8000-000000000002',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),0::bigint,'Assigned tutor who loses eligibility cannot obtain receive permission');
RESET ROLE;
UPDATE public.classes_students SET unenrolled_at=now()-interval '1 minute'
WHERE student_id='10000000-0000-0000-0000-000000000001' AND class_id='20000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM realtime.messages WHERE event='interview-authorization-probe'),0::bigint,'Selected student whose interview enrolment ends cannot obtain receive permission');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
