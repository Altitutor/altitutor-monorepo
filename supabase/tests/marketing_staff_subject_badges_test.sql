BEGIN;
SELECT plan(4);
INSERT INTO public.staff_marketing_profiles(staff_id,published)
VALUES ('00000000-0000-0000-0000-000000000010',true)
ON CONFLICT(staff_id) DO UPDATE SET published=true;
WITH added AS (
  INSERT INTO public.subjects(name,curriculum,year_level)
  VALUES ('Badge test Biology','SACE',11),('Badge test Biology','SACE',12),
    ('Badge test Biology','IB',11),('Badge test Biology','IB',12),
    ('Badge test English','PRIMARY',0),('Badge test English','PRIMARY',6),
    ('Badge test Maths','PRESACE',7),('Badge test Maths','PRESACE',10)
  RETURNING id
)
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT '00000000-0000-0000-0000-000000000010',id FROM added;
SET LOCAL ROLE anon;
SELECT is((SELECT count(*)::int FROM public.vmarketing_staff_profiles p, jsonb_array_elements(p.subjects) s
  WHERE p.staff_id='00000000-0000-0000-0000-000000000010' AND s->>'name'='Badge test Biology'),2,'IB and SACE Biology remain distinct, years deduplicated');
SELECT is((SELECT count(*)::int FROM public.vmarketing_staff_profiles p, jsonb_array_elements(p.subjects) s
  WHERE p.staff_id='00000000-0000-0000-0000-000000000010' AND s->>'name'='Badge test English'),1,'primary reception through year six deduplicated');
SELECT is((SELECT count(*)::int FROM public.vmarketing_staff_profiles p, jsonb_array_elements(p.subjects) s
  WHERE p.staff_id='00000000-0000-0000-0000-000000000010' AND s->>'name'='Badge test Maths'),1,'pre-SACE years deduplicated');
SELECT ok(NOT EXISTS(SELECT 1 FROM public.vmarketing_staff_profiles p,jsonb_array_elements(p.subjects) s WHERE s ? 'staff_id' OR s ? 'year_level'),'only public subject labels are exposed');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
