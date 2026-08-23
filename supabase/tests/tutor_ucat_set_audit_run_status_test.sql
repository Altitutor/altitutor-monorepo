BEGIN;

SELECT plan(6);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects
WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;

INSERT INTO public.ucat_mcp_audit_runs (
  id,
  title,
  status,
  idempotency_key,
  request_hash,
  created_by,
  oauth_client_id
) VALUES (
  '54320000-0000-4000-8000-000000000001',
  'Audit run status test',
  'selecting',
  'audit-run-status-test',
  repeat('b', 64),
  (SELECT id FROM public.staff WHERE user_id = '00000000-0000-0000-0000-000000000010'),
  'local-test'
);

INSERT INTO public.ucat_mcp_audit_run_targets (
  id,
  run_id,
  content_type,
  content_id
) VALUES (
  '54320000-0000-4000-8000-000000000002',
  '54320000-0000-4000-8000-000000000001',
  'stem',
  (SELECT id FROM public.question_stems ORDER BY id LIMIT 1)
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT is(
  public.tutor_ucat_set_audit_run_status(
    '54320000-0000-4000-8000-000000000001',
    'active'
  )->>'status',
  'active',
  'an UCAT tutor can move a selecting audit to active'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_set_audit_run_status(
    '54320000-0000-4000-8000-000000000001',
    'completed'
  )$$,
  'P0001',
  'audit_run_has_unfinished_targets',
  'an audit with unfinished targets cannot be completed'
);

RESET ROLE;
UPDATE public.ucat_mcp_audit_run_targets
SET status = 'completed', completed_at = NOW()
WHERE id = '54320000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;

SELECT is(
  public.tutor_ucat_set_audit_run_status(
    '54320000-0000-4000-8000-000000000001',
    'completed'
  )->>'status',
  'completed',
  'a finished audit can be completed'
);

SELECT is(
  public.tutor_ucat_set_audit_run_status(
    '54320000-0000-4000-8000-000000000001',
    'cancelled'
  )->>'status',
  'cancelled',
  'a completed audit can be cancelled from the board'
);

SELECT is(
  public.tutor_ucat_set_audit_run_status(
    '54320000-0000-4000-8000-000000000001',
    'active'
  )->>'status',
  'active',
  'a cancelled audit can be reopened as active'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_set_audit_run_status(
    '54320000-0000-4000-8000-000000000001',
    'archived'
  )$$,
  'P0001',
  'invalid_audit_run_status',
  'unknown run statuses are rejected'
);

SELECT * FROM finish();
ROLLBACK;
