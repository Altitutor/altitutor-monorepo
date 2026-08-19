BEGIN;
SELECT plan(8);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.tutor_ucat_mcp_list_audit_runs(text,timestamp with time zone,uuid,integer)',
    'EXECUTE'
  ),
  'authenticated tutors can list their audit runs'
);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT staff.id, subject.id
FROM public.staff staff
CROSS JOIN public.subjects subject
WHERE staff.id IN (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000011'
)
  AND subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

INSERT INTO public.ucat_mcp_audit_runs (
  id, title, status, published_write_mode, selector, idempotency_key,
  request_hash, created_by, oauth_client_id, created_at
) VALUES
  (
    '71000000-0000-0000-0000-000000000001', 'Old completed audit', 'completed',
    'proposal_only', '{"kind":"manual"}', 'audit-list-old', repeat('1', 64),
    '00000000-0000-0000-0000-000000000010', 'test-client', '2026-08-17 10:00:00+00'
  ),
  (
    '71000000-0000-0000-0000-000000000002', 'Active audit', 'active',
    'proposal_only', '{"kind":"manual"}', 'audit-list-active', repeat('2', 64),
    '00000000-0000-0000-0000-000000000010', 'test-client', '2026-08-18 10:00:00+00'
  ),
  (
    '71000000-0000-0000-0000-000000000003', 'Newest audit', 'selecting',
    'apply_valid_changes', '{"kind":"manual"}', 'audit-list-newest', repeat('3', 64),
    '00000000-0000-0000-0000-000000000010', 'test-client', '2026-08-19 10:00:00+00'
  ),
  (
    '71000000-0000-0000-0000-000000000004', 'Another tutor audit', 'active',
    'proposal_only', '{"kind":"manual"}', 'audit-list-other', repeat('4', 64),
    '00000000-0000-0000-0000-000000000011', 'test-client', '2026-08-19 11:00:00+00'
  );

INSERT INTO public.ucat_mcp_audit_run_targets (
  run_id, content_type, content_id, status
) VALUES
  (
    '71000000-0000-0000-0000-000000000003', 'stem',
    '72000000-0000-0000-0000-000000000001', 'completed'
  ),
  (
    '71000000-0000-0000-0000-000000000003', 'stem',
    '72000000-0000-0000-0000-000000000002', 'failed'
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(
  jsonb_array_length(public.tutor_ucat_mcp_list_audit_runs(NULL, NULL, NULL, 2)->'runs'),
  2,
  'listing respects the requested page size'
);

SELECT is(
  public.tutor_ucat_mcp_list_audit_runs(NULL, NULL, NULL, 2)#>>'{runs,0,run,id}',
  '71000000-0000-0000-0000-000000000003',
  'listing returns newest runs first'
);

SELECT is(
  public.tutor_ucat_mcp_list_audit_runs(NULL, NULL, NULL, 2)#>>'{runs,0,targetCounts,completed}',
  '1',
  'listing includes per-status target counts'
);

SELECT is(
  public.tutor_ucat_mcp_list_audit_runs('active', NULL, NULL, 10)#>>'{runs,0,run,id}',
  '71000000-0000-0000-0000-000000000002',
  'listing filters by status and tutor ownership'
);

SELECT is(
  public.tutor_ucat_mcp_list_audit_runs(
    NULL,
    '2026-08-18 10:00:00+00',
    '71000000-0000-0000-0000-000000000002',
    10
  )#>>'{runs,0,run,id}',
  '71000000-0000-0000-0000-000000000001',
  'compound cursor returns the next page without overlap'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_mcp_list_audit_runs(NULL, NOW(), NULL, 10)$$,
  'invalid_audit_cursor',
  'partial cursors are rejected'
);

SELECT is(
  public.tutor_ucat_mcp_list_audit_runs(NULL, NULL, NULL, 2)#>>'{nextCursor,id}',
  '71000000-0000-0000-0000-000000000002',
  'a full page returns a cursor for the last visible run'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
