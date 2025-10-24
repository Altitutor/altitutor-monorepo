-- Fix storage policies for resources bucket
-- The existing policies are too restrictive, this allows authenticated users to upload

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Create new policies for the resources bucket
CREATE POLICY "Allow authenticated uploads to resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resources');

CREATE POLICY "Allow authenticated reads from resources"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resources');

CREATE POLICY "Allow authenticated deletes from resources"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resources');

CREATE POLICY "Allow authenticated updates to resources"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resources')
WITH CHECK (bucket_id = 'resources');

