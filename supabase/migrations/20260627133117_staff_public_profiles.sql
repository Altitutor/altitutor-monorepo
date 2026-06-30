-- Public staff profile fields for marketing pages.
-- Bio is plain text with newline-separated paragraphs; rendering code escapes it.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS profile_bio TEXT,
  ADD COLUMN IF NOT EXISTS profile_image_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_profile_image_file_id
  ON public.staff(profile_image_file_id)
  WHERE profile_image_file_id IS NOT NULL;

COMMENT ON COLUMN public.staff.profile_bio IS
  'Public staff biography for marketing pages. Plain text; newline-separated paragraphs.';
COMMENT ON COLUMN public.staff.profile_image_file_id IS
  'Public staff profile image file for marketing pages.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-profile-images',
  'staff-profile-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Public read staff profile images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Staff manage staff profile images" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "Public read staff profile images"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = ''staff-profile-images'')';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping public read policy creation for staff-profile-images - insufficient privileges';
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "Staff manage staff profile images"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''staff-profile-images''
        AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()))
      )
      WITH CHECK (
        bucket_id = ''staff-profile-images''
        AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()))
      )';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping staff manage policy creation for staff-profile-images - insufficient privileges';
  END;
END $$;

DROP POLICY IF EXISTS "Staff create profile image file records" ON public.files;
DROP POLICY IF EXISTS "Staff read profile image file records" ON public.files;

CREATE POLICY "Staff create profile image file records"
  ON public.files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket = 'staff-profile-images'
    AND storage_provider = 'supabase'
    AND storage_path IS NOT NULL
    AND external_url IS NULL
    AND created_by = (SELECT public.current_staff_id())
    AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()))
  );

CREATE POLICY "Staff read profile image file records"
  ON public.files
  FOR SELECT
  TO authenticated
  USING (
    bucket = 'staff-profile-images'
    AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()))
  );

CREATE OR REPLACE VIEW public.vmarketing_staff_profiles
WITH (security_invoker = false)
AS
SELECT
  s.id AS staff_id,
  s.first_name,
  s.last_name,
  NULLIF(BTRIM(s.profile_bio), '') AS profile_bio,
  s.profile_image_file_id,
  f.bucket AS profile_image_bucket,
  f.storage_path AS profile_image_storage_path,
  f.mimetype AS profile_image_mimetype,
  f.metadata AS profile_image_metadata,
  s.updated_at
FROM public.staff s
LEFT JOIN public.files f
  ON f.id = s.profile_image_file_id
  AND f.deleted_at IS NULL
WHERE s.status = 'ACTIVE'
  AND (
    NULLIF(BTRIM(s.profile_bio), '') IS NOT NULL
    OR s.profile_image_file_id IS NOT NULL
  );

GRANT SELECT ON public.vmarketing_staff_profiles TO anon, authenticated;

COMMENT ON VIEW public.vmarketing_staff_profiles IS
  'Public, narrow staff profile view for marketing pages.';

CREATE OR REPLACE VIEW public.vtutor_profile
WITH (security_invoker = false)
AS
SELECT
  s.id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone_number as phone,
  s.role,
  s.status,
  s.user_id,
  s.availability_monday,
  s.availability_tuesday,
  s.availability_wednesday,
  s.availability_thursday,
  s.availability_friday,
  s.availability_saturday_am,
  s.availability_saturday_pm,
  s.availability_sunday_am,
  s.availability_sunday_pm,
  s.created_at,
  s.updated_at,
  s.profile_bio,
  s.profile_image_file_id
FROM public.staff s
WHERE s.id = public.current_tutor_id();

GRANT SELECT ON public.vtutor_profile TO authenticated;
