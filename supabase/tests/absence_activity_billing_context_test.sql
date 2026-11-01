BEGIN;
SELECT plan(3);

INSERT INTO public.invoices (id, student_id, stripe_invoice_id, invoice_date, amount_due_cents, amount_paid_cents, currency, status)
VALUES
 ('fc215000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', 'in_absence_activity_paid', CURRENT_DATE, 0, 9000, 'AUD', 'paid'),
 ('fc215000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000002', 'in_absence_activity_open', CURRENT_DATE, 9000, 0, 'AUD', 'open');

INSERT INTO public.invoice_items (invoice_id, sessions_students_id, stripe_invoice_item_id, amount_cents, description, is_subsidy, is_fee, line_kind, session_id, student_id)
SELECT CASE ss.student_id
 WHEN '10000000-0000-0000-0000-000000000001'::uuid THEN 'fc215000-0000-4000-8000-000000000001'::uuid
 ELSE 'fc215000-0000-4000-8000-000000000002'::uuid END,
 ss.id, 'ii_absence_activity_' || ss.id::text, 9000, 'Session fee', false, false, 'session_charge', ss.session_id, ss.student_id
FROM public.sessions_students ss
WHERE ss.session_id = '50000000-0000-0000-0000-000000000005'
 AND ss.student_id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');

SELECT public.log_student_absences(
 (SELECT jsonb_agg(jsonb_build_object('student_id', student_id, 'original_sessions_students_id', id, 'action', 'credit'))
  FROM public.sessions_students WHERE session_id = '50000000-0000-0000-0000-000000000005'
  AND student_id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002')),
 '00000000-0000-0000-0000-000000000001');

SELECT is(
 (SELECT event.payload->>'absence_billing_context' FROM public.domain_events event
  JOIN public.domain_event_entities link ON link.domain_event_id = event.id
  WHERE event.event_name = 'session.student_credited' AND event.recorded_at >= transaction_timestamp()
  AND link.entity_type = 'student' AND link.entity_id = '10000000-0000-0000-0000-000000000001' LIMIT 1),
 'paid_invoice', 'absence on a paid invoice records account-credit intent, not completed credit');
SELECT is(
 (SELECT event.payload->>'absence_billing_context' FROM public.domain_events event
  JOIN public.domain_event_entities link ON link.domain_event_id = event.id
  WHERE event.event_name = 'session.student_credited' AND event.recorded_at >= transaction_timestamp()
  AND link.entity_type = 'student' AND link.entity_id = '10000000-0000-0000-0000-000000000002' LIMIT 1),
 'unpaid_invoice', 'absence on an unpaid invoice records invoice-reduction intent');

UPDATE public.invoices SET status = 'open' WHERE id = 'fc215000-0000-4000-8000-000000000001';
SELECT is(
 (SELECT event.payload->>'absence_billing_context' FROM public.domain_events event
  JOIN public.domain_event_entities link ON link.domain_event_id = event.id
  WHERE event.event_name = 'session.student_credited' AND event.recorded_at >= transaction_timestamp()
  AND link.entity_type = 'student' AND link.entity_id = '10000000-0000-0000-0000-000000000001' LIMIT 1),
 'paid_invoice', 'later invoice changes do not rewrite the historical absence context');
SELECT * FROM finish();
ROLLBACK;
