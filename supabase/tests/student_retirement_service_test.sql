BEGIN;
SELECT plan(2);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
INSERT INTO public.students(id,first_name,last_name,status) VALUES
 ('fd243000-0000-4000-8000-000000000011','Retirement','Enrolled','ACTIVE');
INSERT INTO public.classes_students(id,student_id,class_id,enrolled_at,unenrolled_at)
SELECT 'fd243000-0000-4000-8000-000000000012','fd243000-0000-4000-8000-000000000011',id,now()-interval '1 day',now()+interval '1 day'
FROM public.classes WHERE subject_id IS NOT NULL LIMIT 1;
SELECT throws_ok($$SELECT public.retire_student('fd243000-0000-4000-8000-000000000011')$$,'P0001','Resolve active enrolments before deleting this Student','scheduled future unenrolment still blocks retirement');
SELECT is((SELECT deleted_at FROM public.students WHERE id='fd243000-0000-4000-8000-000000000011'),NULL::timestamptz,'rejection leaves Student live');
SELECT * FROM finish();
ROLLBACK;
