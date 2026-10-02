-- Admin student delete assumes child rows cascade. A founder redemption
-- without ON DELETE CASCADE raises 23503 and the admin delete route fails.
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
  $$DELETE FROM public.students WHERE id = 'fd920000-0000-4000-8000-000000000001'$$,
  'deleting a student removes a founder redemption instead of raising a foreign key error'
);

RESET ROLE;
SELECT is(
  (SELECT count(*)::integer FROM public.ucat_founder_redemptions WHERE student_id = 'fd920000-0000-4000-8000-000000000001'),
  0,
  'founder redemption does not survive the deleted student'
);

SELECT * FROM finish();
ROLLBACK;
