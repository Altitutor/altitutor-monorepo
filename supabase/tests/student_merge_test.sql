BEGIN;
SELECT plan(26);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
INSERT INTO students(id,first_name,last_name,status,year_level,phone) VALUES
 ('fd510000-0000-4000-8000-000000000001','Merge','Fixture','DISCONTINUED',10,'+61499999101'),
 ('fd510000-0000-4000-8000-000000000002','Merge','Fixture','TRIAL',11,'+61499999102');
INSERT INTO students_billing(student_id,stripe_customer_id) VALUES
 ('fd510000-0000-4000-8000-000000000001','cus_merge_retained'),
 ('fd510000-0000-4000-8000-000000000002','cus_merge_history');
INSERT INTO invoices(student_id,stripe_invoice_id,invoice_date,amount_due_cents,amount_paid_cents,status) VALUES
 ('fd510000-0000-4000-8000-000000000002','in_merge_history',now(),5000,5000,'paid');
INSERT INTO parents(id,first_name,last_name) VALUES('fd510000-0000-4000-8000-000000000003','Merge','Parent');
INSERT INTO parents_students(student_id,parent_id) VALUES
 ('fd510000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000003'),
 ('fd510000-0000-4000-8000-000000000002','fd510000-0000-4000-8000-000000000003');
UPDATE students SET discontinued_at='2026-01-01' WHERE id='fd510000-0000-4000-8000-000000000001';
CREATE TEMP TABLE merge_test_state AS SELECT
 public.preview_student_merge('fd510000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000002')->>'fingerprint' fingerprint,
 '{"confirmed_same_person":true,"reviewed_parent_access":true,"login_user_id":null,"billing_student_id":"fd510000-0000-4000-8000-000000000001","fields":{"status":"source","year_level":"source","phone":"source"}}'::jsonb choices;
SELECT ok(jsonb_array_length(public.student_duplicate_candidates('fd510000-0000-4000-8000-000000000001'))>0,'suggests duplicate by normalized name');
SELECT throws_ok($$SELECT public.merge_students('fd510000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000002','stale',(SELECT choices FROM merge_test_state))$$,'P0001','These records changed. Refresh the preview before merging.','rejects stale previews');
SELECT is((SELECT count(*) FROM students WHERE id IN('fd510000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000002')),2::bigint,'stale merge leaves both students intact');
SELECT lives_ok($$SELECT public.merge_students('fd510000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000002',(SELECT fingerprint FROM merge_test_state),(SELECT choices FROM merge_test_state))$$,'merges two customer records atomically');
SELECT is((SELECT year_level FROM students WHERE id='fd510000-0000-4000-8000-000000000001'),11,'applies selected field');
SELECT is((SELECT student_id FROM invoices WHERE stripe_invoice_id='in_merge_history'),'fd510000-0000-4000-8000-000000000001'::uuid,'preserves invoice under retained student');
SELECT is((SELECT amount_paid_cents FROM invoices WHERE stripe_invoice_id='in_merge_history'),5000,'does not change paid amount');
SELECT is((SELECT count(*) FROM parents_students WHERE student_id='fd510000-0000-4000-8000-000000000001'),1::bigint,'deduplicates common parent');
SELECT is(public.resolve_merged_student_id('fd510000-0000-4000-8000-000000000002'),'fd510000-0000-4000-8000-000000000001'::uuid,'old links resolve to retained student');
SELECT is((SELECT student_id FROM vinternal_student_billing_customers WHERE stripe_customer_id='cus_merge_history'),'fd510000-0000-4000-8000-000000000001'::uuid,'historical customer resolves for signed webhooks');
SELECT ok((SELECT snapshot ? 'invoices.student_id' FROM student_merge_history WHERE source_student_id='fd510000-0000-4000-8000-000000000002'),'keeps dependency audit snapshot');
SELECT throws_ok($$INSERT INTO students(id,first_name,last_name) VALUES('fd510000-0000-4000-8000-000000000002','Recreated','Duplicate')$$,'P0001','This student account was merged. Sign in with the retained account or contact Altitutor.','cannot recreate merged student id');
SELECT lives_ok($$SELECT public.merge_students('fd510000-0000-4000-8000-000000000001','fd510000-0000-4000-8000-000000000002',(SELECT fingerprint FROM merge_test_state),(SELECT choices FROM merge_test_state))$$,'retry of completed request is idempotent');
INSERT INTO invoices(student_id,stripe_invoice_id,invoice_date,amount_due_cents,status) VALUES
 ('fd510000-0000-4000-8000-000000000002','in_merge_late',now(),1000,'open');
SELECT is((SELECT student_id FROM invoices WHERE stripe_invoice_id='in_merge_late'),'fd510000-0000-4000-8000-000000000001'::uuid,'late payment event using old student id resolves safely');
INSERT INTO auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data) VALUES
 ('fd510000-0000-4000-8000-000000000011','merge.one@invalid.test','authenticated','authenticated','{}','{}'),
 ('fd510000-0000-4000-8000-000000000012','merge.two@invalid.test','authenticated','authenticated','{}','{}');
INSERT INTO students(id,first_name,last_name,user_id) VALUES
 ('fd510000-0000-4000-8000-000000000021','Login','Merge','fd510000-0000-4000-8000-000000000011'),
 ('fd510000-0000-4000-8000-000000000022','Login','Merge','fd510000-0000-4000-8000-000000000012');
SELECT lives_ok($$SELECT public.merge_students('fd510000-0000-4000-8000-000000000021','fd510000-0000-4000-8000-000000000022',public.preview_student_merge('fd510000-0000-4000-8000-000000000021','fd510000-0000-4000-8000-000000000022')->>'fingerprint','{"confirmed_same_person":true,"reviewed_parent_access":true,"login_user_id":"fd510000-0000-4000-8000-000000000012","billing_student_id":null,"fields":{}}')$$,'can retain the source login while keeping the other student id');
SELECT is((SELECT user_id FROM students WHERE id='fd510000-0000-4000-8000-000000000021'),'fd510000-0000-4000-8000-000000000012'::uuid,'selected authentication account owns combined student');
SELECT is((SELECT count(*) FROM auth.users WHERE id IN('fd510000-0000-4000-8000-000000000011','fd510000-0000-4000-8000-000000000012')),2::bigint,'merge does not delete authentication accounts or unrelated roles');
SELECT throws_ok($$INSERT INTO students(first_name,last_name,user_id) VALUES('Recreated','Login','fd510000-0000-4000-8000-000000000011')$$,'P0001','This student account was merged. Sign in with the retained account or contact Altitutor.','retired login cannot create another student profile');
SELECT is((SELECT phone_e164 FROM contacts WHERE student_id='fd510000-0000-4000-8000-000000000001'),'+61499999102','only selected phone remains active for messaging');
SELECT is(jsonb_array_length(public.student_message_contacts('fd510000-0000-4000-8000-000000000001')),2,'both phone histories remain accessible');
SELECT lives_ok($$SELECT public.record_student_billing_customer('fd510000-0000-4000-8000-000000000002','cus_merge_late')$$,'late checkout customer is recorded');
SELECT is((SELECT stripe_customer_id FROM students_billing WHERE student_id='fd510000-0000-4000-8000-000000000001'),'cus_merge_retained','late checkout cannot replace chosen future billing setup');
SELECT is((SELECT student_id FROM vinternal_student_billing_customers WHERE stripe_customer_id='cus_merge_late'),'fd510000-0000-4000-8000-000000000001'::uuid,'late checkout invoices retain customer mapping');
SELECT is((SELECT status FROM students WHERE id='fd510000-0000-4000-8000-000000000001'),'TRIAL','retains selected in-person relationship');
SELECT is((SELECT discontinued_at FROM students WHERE id='fd510000-0000-4000-8000-000000000001'),NULL::timestamptz,'relationship dates follow chosen status instead of mixing lifecycles');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT throws_ok($$SELECT public.student_duplicate_candidates(NULL)$$,'42501','Admin access required','student cannot inspect duplicate candidates');
SELECT * FROM finish();
ROLLBACK;
