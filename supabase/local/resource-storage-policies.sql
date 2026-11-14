-- DEV-287: local-only parity for the resource policies specified by
-- 20260625090416_align_student_resource_access.sql. The CLI's initial migration
-- connection can lack storage.objects ownership; its post-start postgres
-- connection can install policies. Run only through the owned runtime helper.
-- No role grants, table ownership changes, or hosted database writes.
BEGIN;
DROP POLICY IF EXISTS "ADMINSTAFF all access to resources" ON storage.objects;
DROP POLICY IF EXISTS "TUTOR create files for their subjects" ON storage.objects;
DROP POLICY IF EXISTS "TUTOR read files for their subjects" ON storage.objects;
DROP POLICY IF EXISTS "STUDENT read authorized files" ON storage.objects;

CREATE POLICY "ADMINSTAFF all access to resources" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'resources' AND (SELECT public.is_adminstaff_active()))
  WITH CHECK (bucket_id = 'resources' AND (SELECT public.is_adminstaff_active()));
CREATE POLICY "TUTOR create files for their subjects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resources' AND (SELECT public.can_tutor_create_file(name)));
CREATE POLICY "TUTOR read files for their subjects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resources' AND (SELECT public.can_tutor_read_file(name)));
CREATE POLICY "STUDENT read authorized files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resources' AND (SELECT public.can_student_read_file(name)));
COMMIT;
