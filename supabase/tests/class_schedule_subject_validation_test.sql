BEGIN;

SELECT plan(5);

-- A legal stored Class can have no current schedule revision. The editor must
-- retain its Subject; the RPC must still reject a subjectless client proposal.
INSERT INTO public.classes (
  id, subject_id, session_type, billing_type, day_of_week, start_time, end_time,
  session_start_date, session_end_date, status
)
VALUES (
  'fa720201-0000-4000-8000-000000000001',
  (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'CLASS', 'CLASS', 2, '13:00', '14:00', '2028-01-01', '2028-01-31', 'ACTIVE'
);

CREATE TEMP TABLE subject_validation_proposal AS
SELECT jsonb_build_object(
  'class_id', id, 'session_type', session_type, 'subject_id', NULL,
  'billing_type', billing_type, 'schedule_type', 'RECURRING',
  'start_date', session_start_date, 'end_date', session_end_date,
  'effective_from', session_start_date, 'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1, 'anchor_date', session_start_date,
  'recurring_rows', jsonb_build_array(jsonb_build_object(
    'day_of_week', day_of_week, 'start_time', start_time, 'end_time', end_time
  ))
) AS proposal FROM public.classes
WHERE id = 'fa720201-0000-4000-8000-000000000001';

SELECT lives_ok(
  $$ SELECT public.preview_class_schedule(proposal) FROM subject_validation_proposal $$,
  'the planner accepts the subjectless client proposal for preview'
);

SELECT throws_ok(
  $$ SELECT public.apply_class_schedule(proposal,
    public.preview_class_schedule(proposal)->>'proposal_hash')
    FROM subject_validation_proposal $$,
  'P0001', 'A Class Subject is required',
  'apply preserves the Class Subject invariant even after a successful preview'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.class_schedule_revisions
   WHERE class_id = 'fa720201-0000-4000-8000-000000000001'),
  0, 'the rejected apply creates no revision'
);

SELECT lives_ok(
  $$ SELECT public.apply_class_schedule(
    proposal || jsonb_build_object('subject_id', (SELECT subject_id FROM public.classes
      WHERE id = 'fa720201-0000-4000-8000-000000000001')),
    public.preview_class_schedule(proposal || jsonb_build_object('subject_id',
      (SELECT subject_id FROM public.classes
       WHERE id = 'fa720201-0000-4000-8000-000000000001')))->>'proposal_hash')
    FROM subject_validation_proposal $$,
  'restoring the stored Subject permits the same schedule to apply'
);

SELECT lives_ok(
  $$ SELECT public.apply_class_schedule(p, public.preview_class_schedule(p)->>'proposal_hash')
    FROM (SELECT proposal || jsonb_build_object(
      'class_id', 'fa720201-0000-4000-8000-000000000002',
      'session_type', 'HOMEWORK_HELP', 'billing_type', NULL
    ) AS p FROM subject_validation_proposal) fixture $$,
  'Homework Help still previews and applies without a Subject'
);

SELECT * FROM finish();
ROLLBACK;
