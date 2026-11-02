BEGIN;
SELECT plan(2);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
INSERT INTO public.students(id,first_name,last_name,status) VALUES
 ('fd243000-0000-4000-8000-000000000021','Retirement','Booking','TRIAL');
INSERT INTO public.sessions(id,type,start_at,end_at,status) VALUES
 ('fd243000-0000-4000-8000-000000000022','TRIAL_SESSION',now()+interval '1 day',now()+interval '25 hours','ACTIVE');
INSERT INTO public.sessions_students(student_id,session_id) VALUES
 ('fd243000-0000-4000-8000-000000000021','fd243000-0000-4000-8000-000000000022');
SELECT throws_ok($$SELECT public.retire_student('fd243000-0000-4000-8000-000000000021')$$,'P0001','Resolve future bookings before deleting this Student','future active booking blocks retirement');
SELECT is((SELECT deleted_at FROM public.students WHERE id='fd243000-0000-4000-8000-000000000021'),NULL::timestamptz,'future-booking rejection leaves Student live');
SELECT * FROM finish();
ROLLBACK;
