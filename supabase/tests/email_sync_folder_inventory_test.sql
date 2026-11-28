BEGIN;
SELECT plan(13);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.email_read_sync_folder_inventory(text, uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.email_reconcile_sync_folder_inventory(text, uuid, jsonb)', 'EXECUTE'),
  'folder inventory APIs are unavailable to browser roles'
);

SET LOCAL ROLE service_role;
SELECT public.email_assert_mailbox('admin@altitutor.com');
SELECT public.email_claim_sync('fa498000-0000-4000-8000-000000000001');

SELECT is(
  public.email_read_sync_folder_inventory('admin@altitutor.com', 'fa498000-0000-4000-8000-000000000001'),
  NULL::text[], 'first pass requires authoritative inventory'
);
SELECT lives_ok(
  $$SELECT public.email_reconcile_sync_folder_inventory(
    'admin@altitutor.com', 'fa498000-0000-4000-8000-000000000001',
    '[{"id":"inventory-inbox","name":"Inbox","role":"inbox"},
      {"id":"inventory-old","name":"Old"}]'
  )$$, 'first complete scan commits inventory'
);
SELECT public.email_release_sync('fa498000-0000-4000-8000-000000000001');
SELECT public.email_claim_sync('fa498000-0000-4000-8000-000000000002');
SELECT is(
  public.email_read_sync_folder_inventory('admin@altitutor.com', 'fa498000-0000-4000-8000-000000000002'),
  ARRAY['inventory-inbox', 'inventory-old'], 'next owner reads the persisted inventory'
);
SELECT throws_ok(
  $$SELECT public.email_read_sync_folder_inventory(
    'admin@development.altitutor.com', 'fa498000-0000-4000-8000-000000000002'
  )$$, '42501', 'Mailbox identity does not match', 'a different mailbox cannot reuse provider IDs'
);
SELECT throws_ok(
  $$SELECT public.email_reconcile_sync_folder_inventory(
    'admin@altitutor.com', 'fa498000-0000-4000-8000-000000000001', '[]'
  )$$, '55000', 'Mailbox sync lease unavailable', 'a former worker cannot replace inventory'
);

INSERT INTO public.email_threads (id) VALUES ('inventory-thread');
INSERT INTO public.email_messages (id, thread_id, folder_id, data)
VALUES ('inventory-message', 'inventory-thread', 'inventory-old', '{}');
UPDATE public.email_mailbox_identity
SET folder_inventory_synced_at = clock_timestamp() - interval '5 minutes';

SELECT is(
  public.email_read_sync_folder_inventory('admin@altitutor.com', 'fa498000-0000-4000-8000-000000000002'),
  NULL::text[], 'stale catalog needs rediscovery'
);
SELECT throws_ok(
  $$SELECT public.email_reconcile_sync_folder_inventory(
    'admin@altitutor.com', 'fa498000-0000-4000-8000-000000000002', '{"id":"partial"}'
  )$$, '22023', 'Expected complete mailbox folder inventory', 'invalid discovery cannot replace inventory'
);
SELECT is(
  public.email_read_sync_folder_inventory('admin@altitutor.com', 'fa498000-0000-4000-8000-000000000002'),
  NULL::text[], 'failed discovery does not refresh the timestamp'
);
SELECT ok(
  (SELECT present FROM public.email_folders WHERE id = 'inventory-old')
  AND (SELECT NOT removed FROM public.email_messages WHERE id = 'inventory-message'),
  'failed discovery preserves existing folders and messages'
);

SELECT public.email_reconcile_sync_folder_inventory(
  'admin@altitutor.com', 'fa498000-0000-4000-8000-000000000002',
  '[{"id":"inventory-inbox","name":"Renamed","role":"inbox"},
    {"id":"inventory-new","name":"New","parent_id":"inventory-inbox"}]'
);
SELECT is(
  public.email_read_sync_folder_inventory('admin@altitutor.com', 'fa498000-0000-4000-8000-000000000002'),
  ARRAY['inventory-inbox', 'inventory-new'], 'successful retry publishes new and existing folders'
);
SELECT ok(
  (SELECT name = 'Renamed' AND role = 'inbox' FROM public.email_folders WHERE id = 'inventory-inbox')
  AND (SELECT parent_id = 'inventory-inbox' FROM public.email_folders WHERE id = 'inventory-new'),
  'complete discovery updates folder names and parent links'
);
SELECT ok(
  (SELECT NOT present FROM public.email_folders WHERE id = 'inventory-old')
  AND (SELECT removed AND folder_id IS NULL FROM public.email_messages WHERE id = 'inventory-message'),
  'only complete discovery removes a folder and its cached membership'
);

SELECT * FROM finish();
ROLLBACK;
