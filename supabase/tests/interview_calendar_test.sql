BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(4);
-- Fixture enrollment and tutor capabilities; behavior is observed only through
-- the public command/read facade, never by asserting internal round JSON.
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011') AND sub.name='Medicine Interview'
ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT public.interview_command('00000000-0000-0000-0000-000000000010', '{"type": "saveCategory", "category": {"id": "e8300000-0000-4000-8000-000000000001", "name": "Personal", "parentId": null}, "commandId": "a75a879c-628a-4264-ab8b-a541345522a9"}');
SELECT public.interview_command('00000000-0000-0000-0000-000000000010', '{"type": "saveStation", "expectedVersion": 0, "station": {"id": "e8300000-0000-4000-8000-000000000100", "name": "Motivation", "categoryId": "e8300000-0000-4000-8000-000000000001", "prompt": "Read this scenario", "maximumPoints": 6.5, "archived": false, "questions": [{"id": "e8300000-0000-4000-8000-000000000002", "stationId": "e8300000-0000-4000-8000-000000000100", "tagIds": [], "question": "Why medicine?", "rubric": "Listen for motivation", "suggestedTimeSeconds": 60}]}, "commandId": "a2afd8a9-5033-40dd-9972-f295d1bde23c"}');
SELECT public.interview_command('00000000-0000-0000-0000-000000000010', '{"type": "saveStation", "expectedVersion": 0, "station": {"id": "e8300000-0000-4000-8000-000000000101", "name": "Follow up", "categoryId": "e8300000-0000-4000-8000-000000000001", "prompt": "Read this scenario", "maximumPoints": 6, "archived": false, "questions": [{"id": "e8300000-0000-4000-8000-000000000003", "stationId": "e8300000-0000-4000-8000-000000000101", "tagIds": [], "question": "Why medicine?", "rubric": "Listen for motivation", "suggestedTimeSeconds": 60}]}, "commandId": "c8858308-04d1-43ba-8e36-31ce912a41dd"}');
SELECT public.interview_command('00000000-0000-0000-0000-000000000010', '{"type": "saveInterview", "expectedVersion": 0, "interview": {"id": "e8300000-0000-4000-8000-000000000010", "name": "Mock MMI", "readingTimeSeconds": 300, "questionTimeSeconds": 1800, "recordingEnabled": true, "archived": false, "stations": [{"id": "e8300000-0000-4000-8000-000000000011", "stationId": "e8300000-0000-4000-8000-000000000100"}, {"id": "e8300000-0000-4000-8000-000000000013", "stationId": "e8300000-0000-4000-8000-000000000101"}]}, "commandId": "97b21b9f-3019-4310-be2b-83e00a2bd6d3"}');
SELECT public.interview_command('00000000-0000-0000-0000-000000000010', '{"type": "createRound", "roundId": "e8300000-0000-4000-8000-000000000020", "setup": {"interviewId": "e8300000-0000-4000-8000-000000000010", "name": "Calendar QA circuit", "delivery": "online", "mode": "exam", "recordingEnabled": true, "scheduledAt": "2026-10-28T10:00:00+10:30", "studentIds": ["10000000-0000-0000-0000-000000000001"], "assignments": [{"stationId": "e8300000-0000-4000-8000-000000000011", "tutorId": "00000000-0000-0000-0000-000000000010"}, {"stationId": "e8300000-0000-4000-8000-000000000013", "tutorId": "00000000-0000-0000-0000-000000000011"}]}, "commandId": "1f8491bb-9b17-4a75-9426-c553c0fafe3f"}');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT extract(epoch FROM ((data->>'scheduledEndAt')::timestamptz - (data->>'scheduledAt')::timestamptz))::integer FROM public.vstudent_interview_rounds WHERE id='e8300000-0000-4000-8000-000000000020'),4200,'Student calendar estimates both 35-minute station rotations');
SELECT ok((SELECT NOT (data ?| ARRAY['readingTimeSeconds','questionTimeSeconds','attempts','tutors','students']) FROM public.vstudent_interview_rounds WHERE id='e8300000-0000-4000-8000-000000000020'),'Calendar estimate does not expose phase lengths or private assessment/rosters');
SELECT is((SELECT data->'prompt' FROM public.vstudent_interview_rounds WHERE id='e8300000-0000-4000-8000-000000000020'),'null'::jsonb,'Scheduled calendar does not reveal a reading prompt');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_rounds WHERE id='e8300000-0000-4000-8000-000000000020'),0::bigint,'Unassigned student cannot read the calendar round');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
