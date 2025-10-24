-- ========================
-- CREATE RESOURCES STORAGE BUCKET
-- ========================

-- Create the resources bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false)
ON CONFLICT (id) DO NOTHING;

-- ========================
-- STORAGE POLICIES FOR RESOURCES BUCKET
-- ========================

-- Allow authenticated admin users to upload files
CREATE POLICY "Admin users can upload files to resources bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resources' AND
  COALESCE(
    (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
    ''
  ) = 'ADMIN'
);

-- Allow authenticated admin users to read files
CREATE POLICY "Admin users can read files from resources bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resources' AND
  COALESCE(
    (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
    ''
  ) = 'ADMIN'
);

-- Allow authenticated admin users to update files
CREATE POLICY "Admin users can update files in resources bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resources' AND
  COALESCE(
    (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
    ''
  ) = 'ADMIN'
)
WITH CHECK (
  bucket_id = 'resources' AND
  COALESCE(
    (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
    ''
  ) = 'ADMIN'
);

-- Allow authenticated admin users to delete files
CREATE POLICY "Admin users can delete files from resources bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'resources' AND
  COALESCE(
    (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
    ''
  ) = 'ADMIN'
);

