BEGIN;

SELECT plan(7);

SELECT public.record_domain_event(
  'class.student_added',
  'class',
  '20000000-0000-0000-0000-000000000001',
  jsonb_build_array(
    jsonb_build_object(
      'entity_type', 'class',
      'entity_id', '20000000-0000-0000-0000-000000000001',
      'role', 'subject'
    ),
    jsonb_build_object(
      'entity_type', 'student',
      'entity_id', '10000000-0000-0000-0000-000000000001',
      'role', 'member'
    )
  ),
  '{}'::JSONB,
  '2026-08-20T10:00:00Z'::TIMESTAMPTZ,
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'feed-context-class-student-test',
  'test',
  FALSE
);

SELECT is(
  (
    SELECT display_name
    FROM public.domain_event_entities
    WHERE domain_event_id = (
      SELECT id FROM public.domain_events
      WHERE idempotency_key = 'feed-context-class-student-test'
    )
      AND entity_type = 'student'
  ),
  'Alice Williams',
  'linked entity names are snapshotted when the lifecycle event is recorded'
);

SELECT is(
  (
    SELECT actor_name
    FROM public.vadmin_domain_event_feed
    WHERE id = (
      SELECT id FROM public.domain_events
      WHERE idempotency_key = 'feed-context-class-student-test'
    )
    LIMIT 1
  ),
  'Admin User',
  'the feed resolves the staff actor name in the same query'
);

SELECT ok(
  (
    SELECT linked_entities @> jsonb_build_array(jsonb_build_object(
      'entity_type', 'class',
      'entity_id', '20000000-0000-0000-0000-000000000001',
      'role', 'subject',
      'display_name', public.domain_entity_display_name(
        'class',
        '20000000-0000-0000-0000-000000000001'
      )
    ))
    FROM public.vadmin_domain_event_feed
    WHERE id = (
      SELECT id FROM public.domain_events
      WHERE idempotency_key = 'feed-context-class-student-test'
    )
    LIMIT 1
  ),
  'the feed returns all linked entity references for clickable messages'
);

SELECT is(
  (
    SELECT effective_at
    FROM public.vadmin_domain_event_feed
    WHERE id = (
      SELECT id FROM public.domain_events
      WHERE idempotency_key = 'feed-context-class-student-test'
    )
    LIMIT 1
  ),
  '2026-08-20T10:00:00Z'::TIMESTAMPTZ,
  'effective time remains available as lifecycle metadata'
);

INSERT INTO public.invoices (
  id,
  student_id,
  stripe_invoice_id,
  stripe_invoice_number,
  invoice_date,
  amount_due_cents,
  amount_paid_cents,
  status
) VALUES (
  'fe100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'in_feed_context_test',
  'INV-CONTEXT-1',
  '2099-01-01',
  10000,
  0,
  'open'
);

INSERT INTO public.invoice_items (
  id,
  invoice_id,
  sessions_students_id,
  stripe_invoice_item_id,
  amount_cents,
  description,
  session_id,
  student_id
)
SELECT
  'fe100000-0000-4000-8000-000000000002',
  'fe100000-0000-4000-8000-000000000001',
  session_student.id,
  'ii_feed_context_test',
  10000,
  'Session fee',
  session_student.session_id,
  session_student.student_id
FROM public.sessions_students session_student
WHERE session_student.student_id = '10000000-0000-0000-0000-000000000001'
ORDER BY session_student.created_at
LIMIT 1;

SELECT is(
  (
    SELECT count(*)
    FROM public.domain_events
    WHERE event_name = 'invoice.issued'
      AND subject_id = 'fe100000-0000-4000-8000-000000000001'
  ),
  1::BIGINT,
  'opening the invoice records the issued lifecycle event'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.domain_event_entities event_entity
    JOIN public.domain_events event ON event.id = event_entity.domain_event_id
    JOIN public.invoice_items invoice_item
      ON invoice_item.invoice_id = event.subject_id
     AND invoice_item.session_id = event_entity.entity_id
    WHERE event.event_name = 'invoice.issued'
      AND event.subject_id = 'fe100000-0000-4000-8000-000000000001'
      AND event_entity.entity_type = 'session'
  ),
  1::BIGINT,
  'invoice item changes automatically link invoice lifecycle events to their sessions'
);

SELECT ok(
  (
    SELECT event_entity.display_name = public.domain_entity_display_name(
      'session',
      event_entity.entity_id
    )
    FROM public.domain_event_entities event_entity
    JOIN public.domain_events event ON event.id = event_entity.domain_event_id
    WHERE event.event_name = 'invoice.issued'
      AND event.subject_id = 'fe100000-0000-4000-8000-000000000001'
      AND event_entity.entity_type = 'session'
    LIMIT 1
  ),
  'invoice session links carry the snapshotted session name'
);

SELECT * FROM finish();
ROLLBACK;
