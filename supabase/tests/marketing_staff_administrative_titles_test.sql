BEGIN;
SELECT plan(2);
INSERT INTO public.staff_marketing_profiles(staff_id,published,public_title)
VALUES ('00000000-0000-0000-0000-000000000001',true,'Course manager Tutor: Biology, UCAT')
ON CONFLICT(staff_id) DO UPDATE SET published=true, public_title=excluded.public_title;
SET LOCAL ROLE anon;
SELECT is((SELECT public_title FROM public.vmarketing_staff_profiles WHERE staff_id='00000000-0000-0000-0000-000000000001'),E'Course manager\nAdministrative staff','admin title is derived while preserving the role and removing old subjects');
RESET ROLE;
UPDATE public.staff_marketing_profiles SET public_title='Administrative staff' WHERE staff_id='00000000-0000-0000-0000-000000000001';
SELECT is((SELECT public_title FROM public.vmarketing_staff_profiles WHERE staff_id='00000000-0000-0000-0000-000000000001'),'Administrative staff','existing admin titles are not duplicated');
SELECT * FROM finish();
ROLLBACK;
