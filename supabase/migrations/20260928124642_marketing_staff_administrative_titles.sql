-- Derive the public administrative title from the current staff role.
CREATE OR REPLACE VIEW public.vmarketing_staff_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT s.id AS staff_id, s.first_name, s.last_name,
  NULLIF(BTRIM(s.profile_bio), '') AS profile_bio,
  f.id AS profile_image_file_id,
  f.bucket AS profile_image_bucket,
  f.storage_path AS profile_image_storage_path,
  f.mimetype AS profile_image_mimetype,
  jsonb_build_object('profileImageCrop', f.metadata->'profileImageCrop') AS profile_image_metadata,
  s.updated_at,
  COALESCE(NULLIF(BTRIM(p.display_name), ''), BTRIM(s.first_name) || ' ' || BTRIM(s.last_name)) AS display_name,
  CASE WHEN s.role = 'ADMINSTAFF' AND p.public_title !~* 'administrative staff'
    THEN concat_ws(E'\n', NULLIF(btrim(regexp_replace(p.public_title, '\s*Tutor\s*:.*$', '', 'i')), ''), 'Administrative staff')
    ELSE btrim(regexp_replace(p.public_title, '\s*Tutor\s*:.*$', '', 'i'))
  END AS public_title, p.display_order,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name', assigned.name, 'curriculum', assigned.curriculum)
      ORDER BY assigned.curriculum, assigned.name)
    FROM (
      SELECT DISTINCT subject.name, subject.curriculum
      FROM public.staff_subjects assignment
      JOIN public.subjects subject ON subject.id = assignment.subject_id
      WHERE assignment.staff_id = s.id
    ) assigned
  ), '[]'::jsonb) AS subjects
FROM public.staff s
JOIN public.staff_marketing_profiles p ON p.staff_id = s.id AND p.published
LEFT JOIN public.files f ON f.id = s.profile_image_file_id
  AND f.deleted_at IS NULL AND f.bucket = 'staff-profile-images'
WHERE s.status = 'ACTIVE';
GRANT SELECT ON public.vmarketing_staff_profiles TO anon, authenticated;
COMMENT ON VIEW public.vmarketing_staff_profiles IS
  'Public allowlist of active, explicitly published staff; excludes internal staff and file metadata.';


