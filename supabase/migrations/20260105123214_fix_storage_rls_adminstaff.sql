-- Fix storage RLS policies for resources bucket
-- Drops all existing policies and creates a single ADMINSTAFF policy
-- This makes dev and prod consistent

-- Drop all existing policies on storage.objects
DROP POLICY IF EXISTS "Admin users can upload files to resources bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can read files from resources bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can update files in resources bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can delete files from resources bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to resources" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from resources" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from resources" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to resources" ON storage.objects;

-- Create single ADMINSTAFF policy for full access to resources bucket
CREATE POLICY adminstaff_all_resources_storage ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'resources' AND
    COALESCE(
      (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  )
  WITH CHECK (
    bucket_id = 'resources' AND
    COALESCE(
      (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  );

