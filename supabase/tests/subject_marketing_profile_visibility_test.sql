BEGIN;
SELECT plan(6);

SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.subjects
  WHERE lower(btrim(name)) IN ('medicine interview', 'homework help')
    AND show_on_marketing_profiles
), 'initial exclusions are stored on the subjects');

INSERT INTO public.staff_marketing_profiles (staff_id, published)
VALUES ('00000000-0000-0000-0000-000000000010', true)
ON CONFLICT (staff_id) DO UPDATE SET published = true;

INSERT INTO public.subjects (id, name, curriculum)
VALUES ('f1880000-0000-4000-8000-000000000001', 'Visibility test subject', 'SACE');
INSERT INTO public.staff_subjects (staff_id, subject_id)
VALUES ('00000000-0000-0000-0000-000000000010', 'f1880000-0000-4000-8000-000000000001');

SET LOCAL ROLE anon;
SELECT ok(EXISTS (
  SELECT 1 FROM public.vmarketing_staff_profiles p, jsonb_array_elements(p.subjects) s
  WHERE p.staff_id = '00000000-0000-0000-0000-000000000010'
    AND s->>'name' = 'Visibility test subject'
), 'new subjects are shown by default');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
UPDATE public.subjects SET show_on_marketing_profiles = false
WHERE id = 'f1880000-0000-4000-8000-000000000001';
RESET ROLE;

SET LOCAL ROLE anon;
SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.vmarketing_staff_profiles p, jsonb_array_elements(p.subjects) s
  WHERE p.staff_id = '00000000-0000-0000-0000-000000000010'
    AND s->>'name' = 'Visibility test subject'
), 'admin exclusion removes subject from the anonymous public response');
RESET ROLE;

SELECT ok(EXISTS (
  SELECT 1 FROM public.staff_subjects
  WHERE staff_id = '00000000-0000-0000-0000-000000000010'
    AND subject_id = 'f1880000-0000-4000-8000-000000000001'
), 'hiding a subject preserves the internal assignment');

UPDATE public.subjects SET show_on_marketing_profiles = true
WHERE id = 'f1880000-0000-4000-8000-000000000001';
SET LOCAL ROLE anon;
SELECT ok(EXISTS (
  SELECT 1 FROM public.vmarketing_staff_profiles p, jsonb_array_elements(p.subjects) s
  WHERE p.staff_id = '00000000-0000-0000-0000-000000000010'
    AND s->>'name' = 'Visibility test subject'
), 're-enabling restores the subject without a code change');
RESET ROLE;

UPDATE public.subjects SET show_on_marketing_profiles = false
WHERE id = 'f1880000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
SELECT ok(EXISTS (
  SELECT 1 FROM public.vtutor_subjects
  WHERE id = 'f1880000-0000-4000-8000-000000000001'
), 'tutor retains internal subject access');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
