BEGIN;

SELECT plan(24);

SELECT ok(
  (SELECT bool_and(event_names @> ARRAY[
      'session.student_absence_recorded',
      'session.student_rescheduled',
      'session.student_credited'
    ])
   FROM public.automation_rules
   WHERE name IN (
     'Notify student when an absence is logged',
     'Notify session staff when a student absence is logged'
   )),
  'student absence automations retain reschedule and credit behavior'
);

SELECT ok(
  (SELECT event_names @> ARRAY['session.staff_added', 'session.staff_swapped']
   FROM public.automation_rules
   WHERE name = 'Notify staff when directly assigned to a session'
   LIMIT 1),
  'staff assignment automation also matches a swap'
);

SELECT ok(
  (SELECT event_names @> ARRAY['session.staff_removed', 'session.staff_swap_reversed']
   FROM public.automation_rules
   WHERE name = 'Notify staff when directly removed from a session'
   LIMIT 1),
  'staff removal automation also matches a reversed swap'
);

CREATE TEMP TABLE absence_test_rows AS
SELECT
  (SELECT id FROM public.sessions_staff
    WHERE session_id = '50000000-0000-0000-0000-000000000005'
      AND staff_id = '00000000-0000-0000-0000-000000000010'
      AND NOT planned_absence LIMIT 1) AS staff_assignment_id,
  (SELECT id FROM public.sessions_students
    WHERE session_id = '50000000-0000-0000-0000-000000000005'
      AND student_id = '10000000-0000-0000-0000-000000000002'
      AND NOT planned_absence LIMIT 1) AS reschedule_assignment_id,
  (SELECT id FROM public.sessions_students
    WHERE session_id = '50000000-0000-0000-0000-000000000005'
      AND student_id = '10000000-0000-0000-0000-000000000001'
      AND NOT planned_absence LIMIT 1) AS credit_assignment_id;

SELECT ok(
  COALESCE((public.log_staff_absences(
    jsonb_build_array(jsonb_build_object(
      'staff_id', '00000000-0000-0000-0000-000000000010',
      'original_sessions_staff_id', (SELECT staff_assignment_id FROM absence_test_rows),
      'action', 'swap',
      'replacement_staff_id', '00000000-0000-0000-0000-000000000013'
    )),
    '00000000-0000-0000-0000-000000000001'
  )->>'success')::boolean, false),
  'staff swap succeeds'
);

SELECT is(
  (SELECT count(*) FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp()
     AND event_name IN ('session.staff_added', 'session.staff_absence_recorded', 'session.staff_swapped')),
  1::bigint,
  'one staff swap records one lifecycle event'
);

SELECT is(
  (SELECT event_name FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp()
     AND event_name IN ('session.staff_added', 'session.staff_absence_recorded', 'session.staff_swapped')),
  'session.staff_swapped',
  'the composite event is staff_swapped'
);

SELECT ok(
  (SELECT linked_entities @> jsonb_build_array(
      jsonb_build_object('entity_type', 'staff', 'entity_id', '00000000-0000-0000-0000-000000000010', 'role', 'staff_out', 'display_name', 'John Doe'),
      jsonb_build_object('entity_type', 'staff', 'entity_id', '00000000-0000-0000-0000-000000000013', 'role', 'staff_in', 'display_name', 'Emily Davis')
    )
   FROM public.vadmin_domain_event_feed
   WHERE recorded_at >= transaction_timestamp() AND event_name = 'session.staff_swapped'
   LIMIT 1),
  'the staff swap links and snapshots both staff members'
);

SELECT is(
  (SELECT count(*)
   FROM public.automation_executions execution
   JOIN public.automation_rules rule ON rule.id = execution.rule_id
   WHERE execution.event_name = 'session.staff_swapped'
     AND rule.name = 'Notify staff when directly assigned to a session'
     AND execution.created_at >= transaction_timestamp()),
  1::bigint,
  'a swap enqueues the existing direct-assignment automation once'
);

SELECT ok(
  COALESCE((public.undo_staff_absences(
    jsonb_build_array(jsonb_build_object(
      'staff_id', '00000000-0000-0000-0000-000000000010',
      'original_sessions_staff_id', (SELECT staff_assignment_id FROM absence_test_rows),
      'action', 'swap'
    )),
    '00000000-0000-0000-0000-000000000001'
  )->>'success')::boolean, false),
  'undoing a staff swap succeeds'
);

SELECT is(
  (SELECT count(*) FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp()
     AND event_name IN ('session.staff_removed', 'session.staff_absence_cleared', 'session.staff_swap_reversed')),
  1::bigint,
  'undoing a staff swap records one lifecycle event'
);

SELECT ok(
  COALESCE((public.log_staff_absences(
    jsonb_build_array(jsonb_build_object(
      'staff_id', '00000000-0000-0000-0000-000000000010',
      'original_sessions_staff_id', (SELECT staff_assignment_id FROM absence_test_rows),
      'action', 'log'
    )),
    '00000000-0000-0000-0000-000000000001'
  )->>'success')::boolean, false),
  'standalone staff absence succeeds'
);

SELECT is(
  (SELECT count(*) FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp() AND event_name = 'session.staff_absence_recorded'),
  1::bigint,
  'standalone staff absence remains its own lifecycle event'
);

SELECT set_config('app.class_schedule_apply', 'true', true);
INSERT INTO public.sessions (
  id, class_id, subject_id, type, start_at, end_at, status, long_name, short_name
)
SELECT
  'fe200000-0000-4000-8000-000000000001', class_id, subject_id, type,
  now() + interval '14 days', now() + interval '14 days 90 minutes', 'ACTIVE',
  'Replacement Mathematics Session', 'Replacement Maths'
FROM public.sessions WHERE id = '50000000-0000-0000-0000-000000000005';
SELECT set_config('app.class_schedule_apply', 'false', true);

SELECT ok(
  COALESCE((public.log_student_absences(
    jsonb_build_array(jsonb_build_object(
      'student_id', '10000000-0000-0000-0000-000000000002',
      'original_sessions_students_id', (SELECT reschedule_assignment_id FROM absence_test_rows),
      'action', 'reschedule',
      'target_session_id', 'fe200000-0000-4000-8000-000000000001'
    )),
    '00000000-0000-0000-0000-000000000001'
  )->>'success')::boolean, false),
  'student reschedule succeeds'
);

SELECT is(
  (SELECT count(*) FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp()
     AND event_name IN ('session.student_added', 'session.student_absence_recorded', 'session.student_rescheduled')
     AND EXISTS (
       SELECT 1 FROM public.domain_event_entities entity
       WHERE entity.domain_event_id = domain_events.id
         AND entity.entity_type = 'student'
         AND entity.entity_id = '10000000-0000-0000-0000-000000000002'
     )),
  1::bigint,
  'one student reschedule records one lifecycle event'
);

SELECT ok(
  (SELECT linked_entities @> jsonb_build_array(
      jsonb_build_object('entity_type', 'session', 'entity_id', '50000000-0000-0000-0000-000000000005', 'role', 'subject'),
      jsonb_build_object('entity_type', 'session', 'entity_id', 'fe200000-0000-4000-8000-000000000001', 'role', 'session_to')
    )
   FROM public.vadmin_domain_event_feed
   WHERE recorded_at >= transaction_timestamp() AND event_name = 'session.student_rescheduled'
   LIMIT 1),
  'the reschedule links the original and replacement sessions'
);

SELECT is(
  (SELECT count(*)
   FROM public.automation_executions execution
   JOIN public.automation_rules rule ON rule.id = execution.rule_id
   WHERE execution.event_name = 'session.student_rescheduled'
     AND rule.name IN (
       'Notify student when an absence is logged',
       'Notify session staff when a student absence is logged'
     )
     AND execution.created_at >= transaction_timestamp()),
  2::bigint,
  'a reschedule enqueues both existing student-absence automations once'
);

SELECT ok(
  COALESCE((public.undo_student_absences(
    jsonb_build_array(jsonb_build_object(
      'student_id', '10000000-0000-0000-0000-000000000002',
      'original_sessions_students_id', (SELECT reschedule_assignment_id FROM absence_test_rows),
      'action', 'reschedule'
    )),
    '00000000-0000-0000-0000-000000000001'
  )->>'success')::boolean, false),
  'undoing a student reschedule succeeds'
);

SELECT is(
  (SELECT count(*) FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp()
     AND event_name IN ('session.student_removed', 'session.student_absence_cleared', 'session.student_reschedule_reversed')
     AND EXISTS (
       SELECT 1 FROM public.domain_event_entities entity
       WHERE entity.domain_event_id = domain_events.id
         AND entity.entity_type = 'student'
         AND entity.entity_id = '10000000-0000-0000-0000-000000000002'
     )),
  1::bigint,
  'undoing a student reschedule records one lifecycle event'
);

SELECT ok(
  COALESCE((public.log_student_absences(
    jsonb_build_array(jsonb_build_object(
      'student_id', '10000000-0000-0000-0000-000000000001',
      'original_sessions_students_id', (SELECT credit_assignment_id FROM absence_test_rows),
      'action', 'credit'
    )),
    '00000000-0000-0000-0000-000000000001'
  )->>'success')::boolean, false),
  'student credit succeeds'
);

SELECT is(
  (SELECT count(*) FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp()
     AND event_name IN ('session.student_absence_recorded', 'session.student_credited')
     AND EXISTS (
       SELECT 1 FROM public.domain_event_entities entity
       WHERE entity.domain_event_id = domain_events.id
         AND entity.entity_type = 'student'
         AND entity.entity_id = '10000000-0000-0000-0000-000000000001'
     )),
  1::bigint,
  'crediting a planned absence records one lifecycle event'
);

SELECT is(
  (SELECT event_name FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp()
     AND event_name IN ('session.student_absence_recorded', 'session.student_credited')
     AND EXISTS (
       SELECT 1 FROM public.domain_event_entities entity
       WHERE entity.domain_event_id = domain_events.id
         AND entity.entity_type = 'student'
         AND entity.entity_id = '10000000-0000-0000-0000-000000000001'
     )),
  'session.student_credited',
  'the composite event is student_credited'
);

SELECT is(
  (SELECT count(*)
   FROM public.automation_executions execution
   JOIN public.automation_rules rule ON rule.id = execution.rule_id
   WHERE execution.event_name = 'session.student_credited'
     AND rule.name IN (
       'Notify student when an absence is logged',
       'Notify session staff when a student absence is logged'
     )
     AND execution.created_at >= transaction_timestamp()),
  2::bigint,
  'a credit enqueues both existing student-absence automations once'
);

SELECT ok(
  COALESCE((public.undo_student_absences(
    jsonb_build_array(jsonb_build_object(
      'student_id', '10000000-0000-0000-0000-000000000001',
      'original_sessions_students_id', (SELECT credit_assignment_id FROM absence_test_rows),
      'action', 'credit'
    )),
    '00000000-0000-0000-0000-000000000001'
  )->>'success')::boolean, false),
  'undoing a student credit succeeds'
);

SELECT is(
  (SELECT count(*) FROM public.domain_events
   WHERE recorded_at >= transaction_timestamp()
     AND event_name IN ('session.student_absence_cleared', 'session.student_credit_reversed')
     AND EXISTS (
       SELECT 1 FROM public.domain_event_entities entity
       WHERE entity.domain_event_id = domain_events.id
         AND entity.entity_type = 'student'
         AND entity.entity_id = '10000000-0000-0000-0000-000000000001'
     )),
  1::bigint,
  'undoing a student credit records one lifecycle event'
);

SELECT * FROM finish();
ROLLBACK;
