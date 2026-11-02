BEGIN;
SELECT plan(4);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
INSERT INTO public.students(id,first_name,last_name,status) VALUES
 ('fd243000-0000-4000-8000-000000000001','Retirement','History','TRIAL');
INSERT INTO public.onboarding_journeys(id,student_id,label,enquiry_at) VALUES
 ('fd243000-0000-4000-8000-000000000002','fd243000-0000-4000-8000-000000000001','Retained journey',now());
INSERT INTO public.invoices(student_id,stripe_invoice_id,invoice_date,amount_due_cents,amount_paid_cents,status) VALUES
 ('fd243000-0000-4000-8000-000000000001','in_retirement_retained',now(),5000,5000,'paid');
SELECT lives_ok($$SELECT public.retire_student('fd243000-0000-4000-8000-000000000001')$$,'admin retires a Student with retained onboarding and financial history');
SELECT is((SELECT count(*) FROM public.students WHERE id='fd243000-0000-4000-8000-000000000001'),1::bigint,'Student identity remains');
SELECT is((SELECT student_id FROM public.onboarding_journeys WHERE id='fd243000-0000-4000-8000-000000000002'),'fd243000-0000-4000-8000-000000000001'::uuid,'onboarding history remains linked');
SELECT is((SELECT amount_paid_cents FROM public.invoices WHERE stripe_invoice_id='in_retirement_retained'),5000,'paid financial history remains');
SELECT * FROM finish();
ROLLBACK;
