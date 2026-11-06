BEGIN;
SELECT plan(26);

-- A dedicated sibling pair makes unauthorized reorder effects observable without
-- depending on global seed ordering. All fixtures are rolled back.
INSERT INTO public.topics (id, name, subject_id, parent_id, index, code)
SELECT fixture.id::uuid, fixture.name, parent.subject_id, parent.id, fixture.index, fixture.code
FROM public.topics parent
CROSS JOIN (VALUES
  ('a3420000-0000-4000-8000-000000000001', 'First batch topic', 1, '1.1'),
  ('a3420000-0000-4000-8000-000000000002', 'Second batch topic', 2, '1.2')
) fixture(id, name, index, code)
WHERE parent.id = '30000000-0000-0000-0000-000000000010';

INSERT INTO public.files (id, mimetype, filename, size_bytes, storage_provider, bucket, storage_path, created_by)
VALUES
  ('a3420000-0000-4000-8000-000000000011', 'application/pdf', 'first.pdf', 100, 'supabase', 'resources', 'tests/batch-first.pdf', '00000000-0000-0000-0000-000000000001'),
  ('a3420000-0000-4000-8000-000000000012', 'application/pdf', 'second.pdf', 100, 'supabase', 'resources', 'tests/batch-second.pdf', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.topics_files (id, topic_id, type, file_id, is_solutions, created_by)
VALUES
  ('a3420000-0000-4000-8000-000000000021', 'a3420000-0000-4000-8000-000000000001', 'TEST', 'a3420000-0000-4000-8000-000000000011', false, '00000000-0000-0000-0000-000000000001'),
  ('a3420000-0000-4000-8000-000000000022', 'a3420000-0000-4000-8000-000000000001', 'TEST', 'a3420000-0000-4000-8000-000000000012', false, '00000000-0000-0000-0000-000000000001');

-- Inactive AdminStaff must not retain reorder access through their role alone.
UPDATE public.staff SET status = 'INACTIVE' WHERE id = '00000000-0000-0000-0000-000000000002';

SELECT ok(NOT has_function_privilege('anon', 'public.batch_update_topic_indices(jsonb)', 'EXECUTE'), 'batch_update_topic_indices denies anonymous execution');
SELECT ok(has_function_privilege('authenticated', 'public.batch_update_topic_indices(jsonb)', 'EXECUTE'), 'batch_update_topic_indices keeps authenticated entrypoint for AdminStaff');
SELECT ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp']::text[] FROM pg_proc WHERE oid = 'public.batch_update_topic_indices(jsonb)'::regprocedure), 'batch_update_topic_indices pins public with pg_temp last');
SELECT ok(NOT has_function_privilege('anon', 'public.batch_update_topic_file_indices(jsonb)', 'EXECUTE'), 'batch_update_topic_file_indices denies anonymous execution');
SELECT ok(has_function_privilege('authenticated', 'public.batch_update_topic_file_indices(jsonb)', 'EXECUTE'), 'batch_update_topic_file_indices keeps authenticated entrypoint for AdminStaff');
SELECT ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp']::text[] FROM pg_proc WHERE oid = 'public.batch_update_topic_file_indices(jsonb)'::regprocedure), 'batch_update_topic_file_indices pins public with pg_temp last');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT throws_ok($$SELECT public.batch_update_topic_indices('[{"id":"a3420000-0000-4000-8000-000000000001","index":2},{"id":"a3420000-0000-4000-8000-000000000002","index":1}]'::jsonb)$$, '42501', 'Active administrator required', 'student cannot reorder through batch_update_topic_indices');
SELECT throws_ok($$SELECT public.batch_update_topic_file_indices('[{"id":"a3420000-0000-4000-8000-000000000021","index":2},{"id":"a3420000-0000-4000-8000-000000000022","index":1}]'::jsonb)$$, '42501', 'Active administrator required', 'student cannot reorder through batch_update_topic_file_indices');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
SELECT throws_ok($$SELECT public.batch_update_topic_indices('[{"id":"a3420000-0000-4000-8000-000000000001","index":2},{"id":"a3420000-0000-4000-8000-000000000002","index":1}]'::jsonb)$$, '42501', 'Active administrator required', 'tutor cannot reorder through batch_update_topic_indices');
SELECT throws_ok($$SELECT public.batch_update_topic_file_indices('[{"id":"a3420000-0000-4000-8000-000000000021","index":2},{"id":"a3420000-0000-4000-8000-000000000022","index":1}]'::jsonb)$$, '42501', 'Active administrator required', 'tutor cannot reorder through batch_update_topic_file_indices');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT throws_ok($$SELECT public.batch_update_topic_indices('[{"id":"a3420000-0000-4000-8000-000000000001","index":2},{"id":"a3420000-0000-4000-8000-000000000002","index":1}]'::jsonb)$$, '42501', 'Active administrator required', 'inactive AdminStaff cannot reorder through batch_update_topic_indices');
SELECT throws_ok($$SELECT public.batch_update_topic_file_indices('[{"id":"a3420000-0000-4000-8000-000000000021","index":2},{"id":"a3420000-0000-4000-8000-000000000022","index":1}]'::jsonb)$$, '42501', 'Active administrator required', 'inactive AdminStaff cannot reorder through batch_update_topic_file_indices');
SELECT set_config('request.jwt.claims', '{"sub":"a3420000-0000-4000-8000-000000000099","role":"authenticated"}', true);
SELECT throws_ok($$SELECT public.batch_update_topic_indices('[{"id":"a3420000-0000-4000-8000-000000000001","index":2},{"id":"a3420000-0000-4000-8000-000000000002","index":1}]'::jsonb)$$, '42501', 'Active administrator required', 'unlinked signed-in user cannot reorder through batch_update_topic_indices');
SELECT throws_ok($$SELECT public.batch_update_topic_file_indices('[{"id":"a3420000-0000-4000-8000-000000000021","index":2},{"id":"a3420000-0000-4000-8000-000000000022","index":1}]'::jsonb)$$, '42501', 'Active administrator required', 'unlinked signed-in user cannot reorder through batch_update_topic_file_indices');
RESET ROLE;
SELECT is((SELECT index FROM public.topics WHERE id = 'a3420000-0000-4000-8000-000000000001'), 1, 'denied calls leave topic ordering unchanged');
SELECT is((SELECT index FROM public.topics_files WHERE id = 'a3420000-0000-4000-8000-000000000021'), 1, 'denied calls leave file ordering unchanged');
SELECT ok(coalesce(current_setting('app.in_batch_update', true), 'false') <> 'true', 'denied calls do not enable batch-trigger bypass');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT lives_ok($$SELECT public.batch_update_topic_indices('[{"id":"a3420000-0000-4000-8000-000000000001","index":2},{"id":"a3420000-0000-4000-8000-000000000002","index":1}]'::jsonb)$$, 'active AdminStaff can swap sibling indices through batch_update_topic_indices');
SELECT is((SELECT index FROM public.topics WHERE id = 'a3420000-0000-4000-8000-000000000001'), 2, 'authorized topic swap persists');
SELECT is((SELECT code FROM public.topics WHERE id = 'a3420000-0000-4000-8000-000000000001'), '1.1.2', 'topic swap recalculates hierarchy codes');
SELECT lives_ok($$SELECT public.batch_update_topic_file_indices('[{"id":"a3420000-0000-4000-8000-000000000021","index":2},{"id":"a3420000-0000-4000-8000-000000000022","index":1}]'::jsonb)$$, 'active AdminStaff can swap sibling indices through batch_update_topic_file_indices');
SELECT is((SELECT index FROM public.topics_files WHERE id = 'a3420000-0000-4000-8000-000000000021'), 2, 'authorized file swap persists');
SELECT is((SELECT code FROM public.topics_files WHERE id = 'a3420000-0000-4000-8000-000000000021'), '1.1.2T.2', 'file swap recalculates resource codes');
SELECT is(current_setting('app.in_batch_update', true), 'false', 'successful calls restore normal trigger behavior');
SELECT lives_ok($$SELECT public.batch_update_topic_indices('[]'::jsonb)$$, 'active AdminStaff can submit an empty topic batch');
SELECT lives_ok($$SELECT public.batch_update_topic_file_indices('[]'::jsonb)$$, 'active AdminStaff can submit an empty file batch');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
