BEGIN;
SELECT plan(6);
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass),
  'Storage objects retain RLS');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN ('ADMINSTAFF all access to resources', 'TUTOR create files for their subjects',
    'TUTOR read files for their subjects', 'STUDENT read authorized files') AND roles = ARRAY['authenticated']::name[]),
  4, 'all four intended resource policies are installed for authenticated callers');
SELECT is((SELECT cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'TUTOR read files for their subjects'), 'SELECT', 'Tutor read policy remains SELECT only');
SELECT is((SELECT cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'STUDENT read authorized files'), 'SELECT', 'Student read policy remains SELECT only');
SELECT ok((SELECT qual FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'TUTOR read files for their subjects') LIKE '%can_tutor_read_file(name)%',
  'Tutor Storage delegates to the existing resource entitlement helper');
SELECT ok((SELECT qual FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'STUDENT read authorized files') LIKE '%can_student_read_file(name)%',
  'Student Storage delegates to the existing resource entitlement helper');
SELECT * FROM finish();
ROLLBACK;
