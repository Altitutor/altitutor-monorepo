BEGIN;
SELECT plan(8);
INSERT INTO public.staff_marketing_profiles(staff_id, published, public_title)
VALUES ('00000000-0000-0000-0000-000000000010', true, 'Public tutor'),
       ('00000000-0000-0000-0000-000000000001', false, 'Hidden administrator')
ON CONFLICT(staff_id) DO UPDATE SET published=excluded.published;
SET LOCAL ROLE anon;
SELECT ok(EXISTS(SELECT 1 FROM public.vmarketing_staff_profiles WHERE staff_id='00000000-0000-0000-0000-000000000010'), 'anonymous visitors can see published active staff');
SELECT ok(NOT EXISTS(SELECT 1 FROM public.vmarketing_staff_profiles WHERE staff_id='00000000-0000-0000-0000-000000000001'), 'unpublished staff are hidden');
SELECT throws_ok('SELECT * FROM public.staff_marketing_profiles', '42501', NULL, 'anonymous users cannot read publication settings');
RESET ROLE;
UPDATE public.staff SET status='INACTIVE' WHERE id='00000000-0000-0000-0000-000000000010';
SET LOCAL ROLE anon;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.vmarketing_staff_profiles WHERE staff_id='00000000-0000-0000-0000-000000000010'), 'inactive staff are hidden even if published');
RESET ROLE;
UPDATE public.staff SET status='ACTIVE' WHERE id='00000000-0000-0000-0000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is((SELECT count(*)::int FROM public.staff_marketing_profiles),0,'tutors cannot read publication settings');
SELECT throws_ok($$INSERT INTO public.staff_marketing_profiles(staff_id,published) VALUES ('00000000-0000-0000-0000-000000000011',true)$$,'42501',NULL,'tutors cannot publish staff');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT lives_ok($$UPDATE public.staff_marketing_profiles SET public_title='Updated by admin' WHERE staff_id='00000000-0000-0000-0000-000000000010'$$,'active admins can edit publication settings');
SELECT is((SELECT public_title FROM public.staff_marketing_profiles WHERE staff_id='00000000-0000-0000-0000-000000000010'), 'Updated by admin', 'admin update is persisted');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
