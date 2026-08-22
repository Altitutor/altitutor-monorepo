BEGIN;

SELECT plan(4);

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
  '54310000-0000-4000-8000-000000000001',
  'Audit board status test',
  'active',
  'audit-board-status-test',
  repeat('a', 64),
  (SELECT id FROM public.staff WHERE user_id = '00000000-0000-0000-0000-000000000010'),
  'local-test'
);

INSERT INTO public.ucat_mcp_audit_run_targets (
  id,
  run_id,
  content_type,
  content_id
) VALUES (
  '54310000-0000-4000-8000-000000000002',
  '54310000-0000-4000-8000-000000000001',
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
  public.tutor_ucat_set_audit_target_status(
    '54310000-0000-4000-8000-000000000002',
    'in_progress'
  )->>'status',
  'in_progress',
  'an UCAT tutor can move a target on an active audit'
);

SELECT ok(
  (SELECT started_at IS NOT NULL AND completed_at IS NULL
   FROM public.vtutor_ucat_mcp_audit_run_targets
   WHERE id = '54310000-0000-4000-8000-000000000002'),
  'moving a target in progress records its start time'
);

SELECT is(
  public.tutor_ucat_set_audit_target_status(
    '54310000-0000-4000-8000-000000000002',
    'completed'
  )->>'status',
  'completed',
  'an active audit target can be completed manually'
);

RESET ROLE;
UPDATE public.ucat_mcp_audit_runs
SET status = 'completed', completed_at = NOW()
WHERE id = '54310000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$SELECT public.tutor_ucat_set_audit_target_status(
    '54310000-0000-4000-8000-000000000002',
    'pending'
  )$$,
  'P0001',
  'audit_target_not_active',
  'completed audits are read-only'
);

SELECT * FROM finish();
ROLLBACK;
