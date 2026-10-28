BEGIN;
SELECT plan(2);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
INSERT INTO public.students(id,first_name,last_name,status) VALUES
 ('fd243000-0000-4000-8000-000000000031','Retirement','Subscription','TRIAL');
INSERT INTO public.student_subscriptions(student_id,subject_id,stripe_subscription_id,status)
SELECT 'fd243000-0000-4000-8000-000000000031',id,'sub_retirement_unresolved','paused' FROM public.subjects LIMIT 1;
SELECT throws_ok($$SELECT public.retire_student('fd243000-0000-4000-8000-000000000031')$$,'P0001','Resolve subscriptions before deleting this Student','paused subscription remains unresolved');
SELECT is((SELECT deleted_at FROM public.students WHERE id='fd243000-0000-4000-8000-000000000031'),NULL::timestamptz,'subscription rejection leaves Student live');
SELECT * FROM finish();
ROLLBACK;
