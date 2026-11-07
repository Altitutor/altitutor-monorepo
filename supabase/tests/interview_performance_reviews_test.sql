BEGIN;
SELECT plan(22);

UPDATE public.classes SET subject_id = (SELECT id FROM public.subjects WHERE name = 'Medicine Interview')
WHERE id = '20000000-0000-0000-0000-000000000001';
INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000011', id FROM public.subjects WHERE name = 'Medicine Interview'
ON CONFLICT DO NOTHING;

INSERT INTO public.interviews (id, data)
VALUES ('36400000-0000-4000-8000-000000000200', '{"name":"Review mock fixture"}');
INSERT INTO public.interview_rounds (id, interview_id, created_by, tutor_ids, student_ids, data)
VALUES ('36400000-0000-4000-8000-000000000201','36400000-0000-4000-8000-000000000200',
  '00000000-0000-0000-0000-000000000010', ARRAY['00000000-0000-0000-0000-000000000010'::uuid],
  ARRAY['10000000-0000-0000-0000-000000000001'::uuid],
  '{"name":"Before the review","phase":"completed","startedAt":"2026-11-04T05:30:00Z",
     "stations":[{"id":"station-1","name":"Ethics","maximumPoints":6,"questions":[]}],"attempts":[]}'),
 ('36400000-0000-4000-8000-000000000202','36400000-0000-4000-8000-000000000200',
  '00000000-0000-0000-0000-000000000010', ARRAY['00000000-0000-0000-0000-000000000010'::uuid],
  ARRAY['10000000-0000-0000-0000-000000000001'::uuid],
  '{"name":"After the review","phase":"completed","startedAt":"2026-11-06T05:30:00Z",
     "stations":[{"id":"station-1","name":"Ethics","maximumPoints":6,"questions":[]}],"attempts":[]}');
INSERT INTO public.interview_result_releases (round_id, student_id, revision, snapshot, released_by)
VALUES ('36400000-0000-4000-8000-000000000201','10000000-0000-0000-0000-000000000001',1,
  '{"score":4,"possiblePoints":6,"attempts":[{"studentId":"10000000-0000-0000-0000-000000000001","stationId":"station-1","score":4}]}',
  '00000000-0000-0000-0000-000000000010'),
 ('36400000-0000-4000-8000-000000000202','10000000-0000-0000-0000-000000000001',1,
  '{"score":6,"possiblePoints":6,"attempts":[]}', '00000000-0000-0000-0000-000000000010');

SET LOCAL ROLE service_role;
SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000010',
  '{"type":"createReview","id":"36400000-0000-4000-8000-000000000101","date":"2026-11-05"}');
SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000010',
  '{"type":"saveReview","id":"36400000-0000-4000-8000-000000000101","expectedVersion":1,
    "studentId":"10000000-0000-0000-0000-000000000001","date":"2026-11-05",
    "body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original review"}]}]}}');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_performance_reviews), 0::bigint, 'student cannot see their draft');
SELECT is((SELECT count(*) FROM public.interview_performance_reviews), 0::bigint, 'student has no base-table visibility');
SELECT throws_ok(
  $$SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000010','{}')$$,
  '42501', NULL, 'authenticated clients cannot invoke review writes directly');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_performance_reviews), 0::bigint, 'another interview tutor cannot see the draft');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT throws_ok(
  $$SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000011',
    '{"type":"publishReview","id":"36400000-0000-4000-8000-000000000101","expectedVersion":2,
      "studentId":"10000000-0000-0000-0000-000000000001","date":"2026-11-05",
      "body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Wrong tutor"}]}]}}')$$,
  '42501', NULL, 'another interview tutor cannot publish the draft');
SELECT lives_ok(
  $$SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000010',
    '{"type":"publishReview","commandId":"36400000-0000-4000-8000-000000000110","id":"36400000-0000-4000-8000-000000000101","expectedVersion":2,
      "studentId":"10000000-0000-0000-0000-000000000001","date":"2026-11-05",
      "body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original review"}]}]}}')$$,
  'author can publish eligible student feedback');
SELECT is(
  public.interview_performance_review_command('00000000-0000-0000-0000-000000000010',
    '{"type":"publishReview","commandId":"36400000-0000-4000-8000-000000000110","id":"36400000-0000-4000-8000-000000000101","expectedVersion":2,
      "studentId":"10000000-0000-0000-0000-000000000001","date":"2026-11-05",
      "body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original review"}]}]}}'),
  '{"id":"36400000-0000-4000-8000-000000000101","version":3}'::jsonb, 'an identical publication retry returns the original acknowledgement');
SELECT throws_ok(
  $$SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000010',
    '{"type":"publishReview","id":"36400000-0000-4000-8000-000000000101","expectedVersion":2,
      "studentId":"10000000-0000-0000-0000-000000000001","date":"2026-11-05",
      "body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Stale publication"}]}]}}')$$,
  'PT409', NULL, 'retrying a stale publication cannot create another release');
SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000010',
  '{"type":"saveReview","id":"36400000-0000-4000-8000-000000000101","expectedVersion":3,
    "studentId":"10000000-0000-0000-0000-000000000001","date":"2026-11-05",
    "body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Private correction"}]}]}}');
SELECT throws_ok(
  $$SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000010',
    '{"type":"saveReview","id":"36400000-0000-4000-8000-000000000101","expectedVersion":4,
      "studentId":"10000000-0000-0000-0000-000000000002","date":"2026-11-05",
      "body":{"type":"doc","content":[]}}')$$,
  '22023', NULL, 'recipient cannot be changed after publication');
RESET ROLE;

INSERT INTO public.interview_result_releases (round_id, student_id, revision, snapshot, released_by)
VALUES ('36400000-0000-4000-8000-000000000201','10000000-0000-0000-0000-000000000001',2,
  '{"score":5,"possiblePoints":6,"attempts":[{"studentId":"10000000-0000-0000-0000-000000000001","stationId":"station-1","score":5}]}',
  '00000000-0000-0000-0000-000000000010');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is((SELECT data->'body'->'content'->0->'content'->0->>'text' FROM public.vstudent_interview_performance_reviews),
  'Original review', 'student retains the released copy during a correction');
SELECT is((SELECT count(*) FROM public.vstudent_notifications WHERE notification_type = 'interview_performance_review_released'),
  1::bigint, 'one in-app notification is delivered for publication');
SELECT is((SELECT jsonb_array_length(data->'mocks') FROM public.vstudent_interview_performance_reviews), 1, 'publication excludes later mock dates');
SELECT is((SELECT data->'mocks'->0->>'score' FROM public.vstudent_interview_performance_reviews), '4', 'a later mock correction cannot rewrite the published review evidence');
SELECT is((SELECT count(*) FROM public.vstudent_notifications WHERE notification_type = 'interview_mock_result_released'),
  3::bigint, 'the student receives one in-app notification per mock release');
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_performance_reviews), 0::bigint, 'another enrolled student cannot read the review');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}', true);
SELECT is((SELECT data->'body'->'content'->0->'content'->0->>'text' FROM public.vtutor_interview_performance_reviews),
  'Original review', 'other interview tutors see only the published copy');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
SELECT is((SELECT data->'body'->'content'->0->'content'->0->>'text' FROM public.vtutor_interview_performance_reviews),
  'Private correction', 'author can resume the saved correction');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT lives_ok(
  $$SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000011',
    '{"type":"saveTemplate","id":"36400000-0000-4000-8000-000000000102","expectedVersion":0,
      "name":"Interview baseline","body":{"type":"doc","content":[]}}')$$,
  'eligible tutors can save a shared template');
SELECT lives_ok(
  $$SELECT public.interview_performance_review_command('00000000-0000-0000-0000-000000000010',
    '{"type":"publishReview","id":"36400000-0000-4000-8000-000000000101","expectedVersion":4,
      "studentId":"10000000-0000-0000-0000-000000000001","date":"2026-11-05",
      "body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Released correction"}]}]}}')$$,
  'the author can explicitly release a correction');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is((SELECT data->'mocks'->0->>'score' FROM public.vstudent_interview_performance_reviews), '5', 'the new review version captures the latest eligible mock release');
SELECT is((SELECT count(*) FROM public.vstudent_notifications WHERE notification_type = 'interview_performance_review_released'),
  2::bigint, 'a released correction creates a second review notification');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
SELECT is((SELECT name FROM public.vtutor_interview_performance_review_templates), 'Interview baseline', 'other tutors can reuse the saved template');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
