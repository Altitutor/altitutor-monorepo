BEGIN;
SELECT plan(3);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
INSERT INTO auth.users(id,email) VALUES('fd243000-0000-4000-8000-000000000111','reservation-retired@example.test');
INSERT INTO public.students(id,user_id,first_name,last_name,status) VALUES('fd243000-0000-4000-8000-000000000112','fd243000-0000-4000-8000-000000000111','Retirement','Reservation',NULL);
SELECT public.retire_student('fd243000-0000-4000-8000-000000000112');
SELECT throws_ok($$INSERT INTO public.slot_reservations(reserved_by,start_at,end_at,expires_at,session_type) VALUES('fd243000-0000-4000-8000-000000000111',now()+interval '2 days',now()+interval '2 days 1 hour',now()+interval '10 minutes','DRAFTING')$$,'P0001','Restore this Student before starting new activity','retained old session cannot reserve a new future slot');
INSERT INTO auth.users(id,email) VALUES('fd243000-0000-4000-8000-000000000113','reservation-staff@example.test'),('fd243000-0000-4000-8000-000000000116','reservation-fresh@example.test');
INSERT INTO public.students(id,user_id,first_name,last_name,status) VALUES('fd243000-0000-4000-8000-000000000114','fd243000-0000-4000-8000-000000000113','Shared','Student',NULL);
SELECT public.retire_student('fd243000-0000-4000-8000-000000000114');
-- Existing role rules prohibit simultaneous live Staff and Student records. A
-- retained login may acquire a Staff role after its Student is retired.
INSERT INTO public.staff(id,user_id,first_name,last_name,email,status,role) VALUES('fd243000-0000-4000-8000-000000000115','fd243000-0000-4000-8000-000000000113','Shared','Tutor','reservation-staff@example.test','ACTIVE','TUTOR');
SELECT lives_ok($$INSERT INTO public.slot_reservations(reserved_by,start_at,end_at,expires_at,session_type) VALUES('fd243000-0000-4000-8000-000000000113',now()+interval '3 days',now()+interval '3 days 1 hour',now()+interval '10 minutes','DRAFTING')$$,'unrelated live staff access remains available');
SELECT lives_ok($$INSERT INTO public.slot_reservations(reserved_by,start_at,end_at,expires_at,session_type) VALUES('fd243000-0000-4000-8000-000000000116',now()+interval '4 days',now()+interval '4 days 1 hour',now()+interval '10 minutes','DRAFTING')$$,'fresh authenticated signup is not blocked by retired identity rules');
SELECT * FROM finish();
ROLLBACK;
