BEGIN;
SELECT plan(11);
SELECT set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
CREATE TEMP TABLE resource_access_fixture AS
SELECT
  (SELECT id FROM public.subjects ORDER BY id LIMIT 1) AS allowed_subject,
  (SELECT id FROM public.subjects
   WHERE id NOT IN (SELECT subject_id FROM public.vstudent_online_subject_access)
     AND id <> (SELECT id FROM public.subjects ORDER BY id LIMIT 1)
   ORDER BY id LIMIT 1) AS denied_subject;
INSERT INTO public.students_online_access_manual (student_id, subject_id)
SELECT '10000000-0000-0000-0000-000000000001', allowed_subject
FROM resource_access_fixture ON CONFLICT DO NOTHING;
INSERT INTO public.topics(id, subject_id, name, parent_id)
SELECT 'fa212000-0000-4000-8000-000000000001'::uuid, allowed_subject, 'Resource source', NULL::uuid FROM resource_access_fixture
UNION ALL
SELECT 'fa212000-0000-4000-8000-000000000002', allowed_subject, 'Resource destination', NULL FROM resource_access_fixture
UNION ALL
SELECT 'fa212000-0000-4000-8000-000000000003', denied_subject, 'Unentitled destination', NULL FROM resource_access_fixture;
INSERT INTO public.files(id, filename, mimetype, size_bytes, storage_path, bucket, storage_provider)
SELECT 'fa212000-0000-4000-8000-000000000004', 'Synthetic PDF', 'application/pdf', 100,
  allowed_subject::text || '/fa212000-0000-4000-8000-000000000001/resource.pdf', 'resources', 'SUPABASE'
FROM resource_access_fixture;
INSERT INTO public.topics_files(id, topic_id, file_id, type)
VALUES ('fa212000-0000-4000-8000-000000000005', 'fa212000-0000-4000-8000-000000000001',
  'fa212000-0000-4000-8000-000000000004', 'NOTES');
CREATE FUNCTION pg_temp.fixture_file_path() RETURNS text LANGUAGE sql AS $$
  SELECT allowed_subject::text || '/fa212000-0000-4000-8000-000000000001/resource.pdf'
  FROM resource_access_fixture;
$$;

SELECT ok(public.can_student_read_file(pg_temp.fixture_file_path()), 'an entitled Student can read the originally linked object');
UPDATE public.topics_files SET topic_id='fa212000-0000-4000-8000-000000000002'
WHERE id='fa212000-0000-4000-8000-000000000005';
SELECT ok(public.can_student_read_file(pg_temp.fixture_file_path()), 'moving to another entitled topic preserves access to the same stored object');
SELECT ok(NOT public.can_student_read_file(pg_temp.fixture_file_path() || '.other'), 'authorization requires the exact linked object path');
UPDATE public.files SET deleted_at=now() WHERE id='fa212000-0000-4000-8000-000000000004';
SELECT ok(NOT public.can_student_read_file(pg_temp.fixture_file_path()), 'soft-deleted resources remain inaccessible');
UPDATE public.files SET deleted_at=NULL, bucket='other-bucket' WHERE id='fa212000-0000-4000-8000-000000000004';
SELECT ok(NOT public.can_student_read_file(pg_temp.fixture_file_path()), 'a similarly named file in another bucket cannot authorize a resources object');
UPDATE public.files SET bucket='resources' WHERE id='fa212000-0000-4000-8000-000000000004';
DELETE FROM public.topics_files WHERE id='fa212000-0000-4000-8000-000000000005';
SELECT ok(NOT public.can_student_read_file(pg_temp.fixture_file_path()), 'unlinked files remain inaccessible');
INSERT INTO public.topics_files(id, topic_id, file_id, type) VALUES ('fa212000-0000-4000-8000-000000000005', 'fa212000-0000-4000-8000-000000000003', 'fa212000-0000-4000-8000-000000000004', 'NOTES');
SELECT ok(NOT public.can_student_read_file(pg_temp.fixture_file_path()), 'moving to an unentitled current subject revokes access despite the old path');
INSERT INTO public.students_online_access_manual (student_id, subject_id)
SELECT '10000000-0000-0000-0000-000000000001', denied_subject
FROM resource_access_fixture;
SELECT ok(public.can_student_read_file(pg_temp.fixture_file_path()), 'entitlement to the current subject permits the original object path');

INSERT INTO public.files(id, filename, mimetype, size_bytes, storage_path, bucket, storage_provider)
SELECT 'fa212000-0000-4000-8000-000000000006', 'Synthetic cover', 'image/png', 100,
  allowed_subject::text || '/_subject_image/cover.png', 'resources', 'SUPABASE'
FROM resource_access_fixture;
INSERT INTO public.subjects_files(subject_id,file_id)
SELECT allowed_subject,'fa212000-0000-4000-8000-000000000006' FROM resource_access_fixture;
SELECT ok(public.can_student_read_file((SELECT allowed_subject::text || '/_subject_image/cover.png' FROM resource_access_fixture)), 'subject-cover access keeps its separate entitlement contract');
SELECT ok(has_function_privilege('authenticated','public.can_student_read_file(text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.can_student_read_file(text)','EXECUTE'),
  'the authenticated-only helper ACL is preserved');
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT ok(NOT public.can_student_read_file(pg_temp.fixture_file_path()), 'no Student identity grants no resource access');
SELECT * FROM finish();
ROLLBACK;
