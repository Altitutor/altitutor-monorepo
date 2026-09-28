-- Staff own their biography/photo; administrators own website publication.
CREATE TABLE public.staff_marketing_profiles (
  staff_id uuid PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT false,
  display_name text CHECK (char_length(display_name) <= 160),
  public_title text NOT NULL DEFAULT '' CHECK (char_length(public_title) <= 500),
  display_order integer NOT NULL DEFAULT 1000 CHECK (display_order >= 0)
);
ALTER TABLE public.staff_marketing_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_marketing_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_marketing_profiles TO authenticated;
GRANT ALL ON public.staff_marketing_profiles TO service_role;
CREATE POLICY "Active administrators manage website publication"
ON public.staff_marketing_profiles FOR ALL TO authenticated
USING ((SELECT public.is_adminstaff_active()))
WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Intentional owner-executed view: anonymous visitors cannot read staff/files or
-- publication settings directly. Only explicitly published, active staff pass.
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
  p.public_title, p.display_order
FROM public.staff s
JOIN public.staff_marketing_profiles p ON p.staff_id = s.id AND p.published
LEFT JOIN public.files f ON f.id = s.profile_image_file_id
  AND f.deleted_at IS NULL AND f.bucket = 'staff-profile-images'
WHERE s.status = 'ACTIVE';
GRANT SELECT ON public.vmarketing_staff_profiles TO anon, authenticated;
COMMENT ON VIEW public.vmarketing_staff_profiles IS
  'Public allowlist of active, explicitly published staff; excludes internal staff and file metadata.';

-- Initial editorial roster; staff biographies and photos remain staff-owned.
INSERT INTO public.staff_marketing_profiles (staff_id, published, display_name, public_title, display_order)
SELECT s.id, true, v.display_name, v.public_title, v.display_order
FROM (VALUES
  ('Matthew Chua','Matthew Chua','MATHEMATICAL METHODS COURSE MANAGER Tutor: Mathematical Methods, Specialist Mathematics, Physics, Chemistry, Biology, UCAT',0),
  ('Lara Nguyen','Lara Nguyen','ADMINISTRATIVE ASSISTANT Social Media, Marketing and Staff Management',1),
  ('Tim Naylor','Tim Naylor','IB BIOLOGY COURSE MANAGER Tutor: IB Biology, IB Chemistry, IB Mathematics AA',2),
  ('Joshua Gooi','Joshua Gooi','UCAT COURSE MANAGERTutor: Biology, Chemistry, UCAT, Mathematical Methods',3),
  ('Kevin Ling','Kevin Ling','CHEMISTRY COURSE MANAGER Tutor: Biology, Chemistry, UCAT, Mathematical Methods',4),
  ('Shardul Mulye','Shardul Mulye','PRESACE COURSE MANAGER Tutor: Mathematical Methods, Biology, Physics, UCAT',5),
  ('Ed Nitschke','Ed Nitschke','Tutor: Mathematical Methods, Chemistry, Pre-SACE Maths',6),
  ('Alexander Wabnitz','Alexander Wabnitz','Tutor: Specialist Mathematics, Mathematical Methods, Pre-SACE Mathematics, Pre-SACE Science',7),
  ('Melshuel George','Melshuel George','Tutor: English, Biology, Pre-SACE Science',8),
  ('Maddie Parker','Maddie Parker','Tutor: Biology, English, AIF',9),
  ('An Do','An Do','ADMINISTRATIVE STAFF Tutor: General Maths, Pre-SACE',10),
  ('Syme Aftab','Syme Aftab','Tutor: Mathematical Methods, Chemistry, Physics',11),
  ('Elliot Koh','Elliot Koh','SOFTWARE DEVELOPMENT Tutor: Pre-SACE Maths, Pre-SACE English',12),
  ('Josh Lee','Josh Lee','Tutor: UCAT, Chemistry, Mathematical Methods, Chemistry, Physics, Biology',13),
  ('Darshil Jangra','Darshil Jang','Tutor: Specialist Mathematics, Mathematical Methods, English, Pre-SACE Science',14),
  ('Rongjun He','RJ He','Tutor: Mathematical Methods, Chemistry, Biology, English',15),
  ('Alessia D''Angelis','Alessia D''Angelis','Tutor: Physics, Specialist Mathematics, Mathematical Methods, Chemistry, Pre-SACE Maths',16),
  ('Huanzhen Lin','Huanzhen Lin','Tutor: Pre-SACE Science, Pre-SACE Mathematics',17),
  ('Navya Shah','Navya Shah','Tutor: Biology, Mathematical Methods, Pre-SACE Mathematics',18),
  ('Ryan George','Ryan George','Tutor: UCAT, Chemistry, Biology, Pre-SACE Science',19),
  ('Christian Kriek','Christian Kriek','ADMINISTRATIVE STAFF',20),
  ('Jayden Tran','Jayden Tran','Tutor: Mathematical Methods, Pre-SACE Maths',21),
  ('Minah Cho','Minah Cho','Tutor: UCAT',22),
  ('Emma Choi','Emma Choi','',23),
  ('Brian Ju','Brian Ju','Tutor',24)) AS v(name, display_name, public_title, display_order)
JOIN public.staff s ON lower(btrim(s.first_name) || ' ' || btrim(s.last_name)) = lower(v.name)
WHERE s.status = 'ACTIVE'
ON CONFLICT (staff_id) DO NOTHING;
