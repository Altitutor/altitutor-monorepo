-- Admin deletion now retains founder redemption and financial history.
BEGIN;
SELECT no_plan();

INSERT INTO public.students(id, first_name, last_name) VALUES
  ('fd920000-0000-4000-8000-000000000001', 'Founder', 'Delete');
INSERT INTO public.ucat_founder_offers(id, code, name, campaign, kind, percent_off) VALUES
  ('fd920000-0000-4000-8000-000000000010', 'F-DELTEST', 'Delete test', 'founders', 'discount', 20);
INSERT INTO public.ucat_founder_redemptions(offer_id, student_id, kind, status, redeemed_at) VALUES
  ('fd920000-0000-4000-8000-000000000010', 'fd920000-0000-4000-8000-000000000001', 'discount', 'redeemed', now());

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', (
      SELECT user_id FROM public.staff
      WHERE role = 'ADMINSTAFF' AND status = 'ACTIVE' AND user_id IS NOT NULL
      ORDER BY id LIMIT 1
    )
  )::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$SELECT public.retire_student('fd920000-0000-4000-8000-000000000001')$$,
  'admin deletion retains the Student without a foreign key error'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.ucat_founder_redemptions WHERE student_id = 'fd920000-0000-4000-8000-000000000001'),
  1,
  'founder redemption remains linked to the retired Student'
);

SELECT * FROM finish();
ROLLBACK;
