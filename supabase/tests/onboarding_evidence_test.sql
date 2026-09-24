BEGIN;
SELECT plan(14);
INSERT INTO public.students(id,first_name,last_name,status) VALUES ('af010000-0000-4000-8000-000000000001','Onboarding','Contract','ACTIVE');
INSERT INTO public.onboarding_journeys(id,student_id,label,enquiry_at) VALUES ('af010000-0000-4000-8000-000000000002','af010000-0000-4000-8000-000000000001','Contract',now()-interval '30 days');
SELECT is(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'converted_at',null,'No attendance/invoice means no conversion');
INSERT INTO public.sessions(id,class_id,subject_id,type,start_at,end_at,status)
SELECT 'af010000-0000-4000-8000-000000000003',id,subject_id,'CLASS',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','ACTIVE' FROM public.classes WHERE id='20000000-0000-0000-0000-000000000001';
INSERT INTO public.sessions_students(id,student_id,session_id,was_trial) VALUES ('af010000-0000-4000-8000-000000000004','af010000-0000-4000-8000-000000000001','af010000-0000-4000-8000-000000000003',false);
INSERT INTO public.sessions_staff(id,session_id,staff_id,type,created_by) VALUES (gen_random_uuid(),'af010000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000010','MAIN_TUTOR','00000000-0000-0000-0000-000000000010');
INSERT INTO public.tutor_logs(id,session_id,created_by,logged_for_staff_id) VALUES ('af010000-0000-4000-8000-000000000005','af010000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000010');
INSERT INTO public.tutor_logs_student_attendance(tutor_log_id,student_id,attended,was_trial,created_by) VALUES ('af010000-0000-4000-8000-000000000005','af010000-0000-4000-8000-000000000001',true,false,'00000000-0000-0000-0000-000000000010');
SELECT is(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'converted_at',null,'Attendance without payment does not convert');
INSERT INTO public.invoices(id,student_id,stripe_invoice_id,invoice_date,amount_due_cents,amount_paid_cents,currency,status,paid_at)
VALUES ('af010000-0000-4000-8000-000000000006','af010000-0000-4000-8000-000000000001','in_onboarding_contract',current_date,0,0,'aud','paid',now());
SELECT is(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'converted_at',null,'An unrelated paid invoice does not convert');
INSERT INTO public.invoice_items(invoice_id,sessions_students_id,session_id,student_id,amount_cents,description,line_kind,stripe_invoice_item_id)
VALUES ('af010000-0000-4000-8000-000000000006','af010000-0000-4000-8000-000000000004','af010000-0000-4000-8000-000000000003','af010000-0000-4000-8000-000000000001',0,'Subsidized class','session_charge','ii_onboarding_contract');
SELECT is(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'paid_session_id','af010000-0000-4000-8000-000000000003','Finalized zero-value paid invoice counts for matching attendance');
UPDATE public.tutor_logs_student_attendance SET attended=false WHERE tutor_log_id='af010000-0000-4000-8000-000000000005';
SELECT is(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'converted_at',null,'A paid no-show is not a conversion');
UPDATE public.tutor_logs_student_attendance SET attended=true,was_trial=true WHERE tutor_log_id='af010000-0000-4000-8000-000000000005';
SELECT is(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'converted_at',null,'Trial attendance is excluded from paid conversion');
SELECT ok(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'trial_attended_at' IS NOT NULL,'Trial attendance remains independent evidence');
SELECT is(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'trial_form_at',null,'Attendance does not imply a submitted trial form');
UPDATE public.onboarding_journeys SET closed_at=now(),closure_reason='withdrawn' WHERE id='af010000-0000-4000-8000-000000000002';
SELECT ok((SELECT closed_evidence IS NOT NULL FROM public.onboarding_journeys WHERE id='af010000-0000-4000-8000-000000000002'),'Closure snapshots the source evidence');
UPDATE public.tutor_logs_student_attendance SET attended=false WHERE tutor_log_id='af010000-0000-4000-8000-000000000005';
SELECT ok(public.onboarding_evidence('af010000-0000-4000-8000-000000000002')->>'trial_attended_at' IS NOT NULL,'Later source changes do not rewrite a closed journey');
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT * FROM public.onboarding_journeys$$,'42501',null,'Anonymous users cannot read journeys');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.onboarding_journeys),0::bigint,'Unprivileged authenticated users cannot read journeys');
SELECT is(public.onboarding_evidence('af010000-0000-4000-8000-000000000002'),null,'Evidence RPC does not bypass RLS');
SELECT throws_ok($$INSERT INTO public.onboarding_journeys(student_id,label,enquiry_at) VALUES ('af010000-0000-4000-8000-000000000001','Forbidden',now())$$,'42501',null,'Unprivileged users cannot insert journeys');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
