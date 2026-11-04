-- Run after Supabase Storage initialization. Fail deployment if the private guard cannot be installed.
BEGIN;
DROP POLICY IF EXISTS teaching_private_server_only ON storage.objects;
CREATE POLICY teaching_private_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id NOT IN ('teaching-print', 'teaching-lessons'))
WITH CHECK (bucket_id NOT IN ('teaching-print', 'teaching-lessons'));
COMMIT;
