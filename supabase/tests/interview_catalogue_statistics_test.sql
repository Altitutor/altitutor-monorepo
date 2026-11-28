BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview')
WHERE id='20000000-0000-0000-0000-000000000001';
INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000011', id FROM public.subjects WHERE name='Medicine Interview'
ON CONFLICT DO NOTHING;

INSERT INTO public.interview_stations(id,name,category_id,prompt,publication_status)
SELECT '51051000-0000-4000-8000-000000000001','Draft station',id,'"Prompt"','draft'
FROM public.interview_categories ORDER BY id LIMIT 1;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT throws_ok($$
  SELECT public.interview_command('00000000-0000-0000-0000-000000000011',
   '{"type":"saveInterview","commandId":"51051000-0000-4000-8000-000000000011","expectedVersion":0,
     "interview":{"id":"51051000-0000-4000-8000-000000000002","name":"Publication fixture",
     "readingTimeSeconds":60,"questionTimeSeconds":120,"recordingEnabled":false,"archived":false,
     "publicationStatus":"published","stations":[{"id":"51051000-0000-4000-8000-000000000003","stationId":"51051000-0000-4000-8000-000000000001"}]}}')
$$, '22023', 'Publish every station before publishing the interview', 'an interview cannot be published with a draft station');

SELECT lives_ok($$
  SELECT public.interview_command('00000000-0000-0000-0000-000000000011',
   '{"type":"saveInterview","commandId":"51051000-0000-4000-8000-000000000012","expectedVersion":0,
     "interview":{"id":"51051000-0000-4000-8000-000000000002","name":"Publication fixture",
     "readingTimeSeconds":60,"questionTimeSeconds":120,"recordingEnabled":false,"archived":false,
     "publicationStatus":"draft","stations":[{"id":"51051000-0000-4000-8000-000000000003","stationId":"51051000-0000-4000-8000-000000000001"}]}}')
$$, 'an interview author can save draft work with a draft station');
SELECT throws_ok($$
  SELECT public.interview_setup_data('{"interviewId":"51051000-0000-4000-8000-000000000002"}',
    '00000000-0000-0000-0000-000000000011', now())
$$, '22023', 'Publish the interview and its stations before using it in a round', 'draft content cannot be used for a round');
RESET ROLE;

INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
VALUES ('51051000-0000-4000-8000-000000000004','51051000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000011', ARRAY['00000000-0000-0000-0000-000000000011'::uuid],
  ARRAY['10000000-0000-0000-0000-000000000001'::uuid],
  '{"name":"Release fixture","phase":"completed","stations":[{"id":"51051000-0000-4000-8000-000000000003",
    "stationId":"51051000-0000-4000-8000-000000000001","name":"Communication","maximumPoints":6}],
    "assignments":[{"stationId":"51051000-0000-4000-8000-000000000003","tutorId":"00000000-0000-0000-0000-000000000011"}]}');
INSERT INTO public.interview_result_releases(round_id,student_id,revision,snapshot,released_by)
VALUES ('51051000-0000-4000-8000-000000000004','10000000-0000-0000-0000-000000000001',1,
  '{"score":0,"possiblePoints":6,"attempts":[{"studentId":"10000000-0000-0000-0000-000000000001",
   "stationId":"51051000-0000-4000-8000-000000000003","score":0}]}','00000000-0000-0000-0000-000000000011');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT is((SELECT attempt->>'score' FROM public.vtutor_interview_statistics, LATERAL jsonb_array_elements(data->'attempts') attempt
  WHERE attempt->>'roundId'='51051000-0000-4000-8000-000000000004'), '0', 'the assigned tutor sees a released zero score');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_statistics),0::bigint,'students cannot read tutor statistics');
RESET ROLE;

UPDATE public.interview_rounds SET data=jsonb_set(data,'{withdrawnResultRevisions}','{"10000000-0000-0000-0000-000000000001":1}')
WHERE id='51051000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_statistics, LATERAL jsonb_array_elements(data->'attempts') attempt
  WHERE attempt->>'roundId'='51051000-0000-4000-8000-000000000004'),0::bigint,'withdrawn results are excluded');
RESET ROLE;

UPDATE public.interview_rounds SET data=jsonb_set(data,'{attempts}',
  '[{"studentId":"10000000-0000-0000-0000-000000000001","stationId":"51051000-0000-4000-8000-000000000003","score":3}]')
WHERE id='51051000-0000-4000-8000-000000000004';
INSERT INTO public.interview_performance_reviews(id,author_id,student_id,review_date)
VALUES ('51051000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000001',current_date);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT is((SELECT attempt->>'mockScore' FROM public.vtutor_interview_statistics, LATERAL jsonb_array_elements(data->'attempts') attempt
  WHERE attempt->>'roundId'='51051000-0000-4000-8000-000000000004'), '3', 'tutor statistics include corrected marks before student release');
SELECT cmp_ok((SELECT (tutor->>'reviews')::integer FROM public.vtutor_interview_statistics, LATERAL jsonb_array_elements(data->'tutors') tutor
  WHERE tutor->>'id'='00000000-0000-0000-0000-000000000011'), '>=', 1, 'the tutor count includes a draft performance review');
RESET ROLE;

UPDATE public.interview_rounds SET data=jsonb_set(data,'{attempts,0,notAssessedReason}','"Not scored"')
WHERE id='51051000-0000-4000-8000-000000000004';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
SELECT cmp_ok((SELECT (tutor->>'interviews')::integer FROM public.vtutor_interview_statistics, LATERAL jsonb_array_elements(data->'tutors') tutor
  WHERE tutor->>'id'='00000000-0000-0000-0000-000000000011'), '>=', 1, 'a tutor counts a completed interview when the encounter was unscored');
SELECT is((SELECT attempt->'score' FROM public.vtutor_interview_statistics, LATERAL jsonb_array_elements(data->'attempts') attempt
  WHERE attempt->>'roundId'='51051000-0000-4000-8000-000000000004'), 'null'::jsonb, 'an unscored encounter appears without its superseded mark');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
