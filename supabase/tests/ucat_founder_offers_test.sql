BEGIN;
SELECT no_plan();
INSERT INTO public.students(id, first_name, last_name) SELECT
  ('fd900000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'Founder', 'Test ' || n FROM generate_series(1,10) n;
INSERT INTO public.ucat_founder_offers(id, code, name, campaign, kind, duration_unit, duration_count, max_redemptions) VALUES
 ('fd910000-0000-4000-8000-000000000001','F-ONE','Personal pass','friends','access_pass','week',2,1),
 ('fd910000-0000-4000-8000-000000000002','F-MONTH','Month pass','friends','access_pass','month',1,NULL);
INSERT INTO public.ucat_founder_offers(id, code, name, campaign, kind, percent_off, max_redemptions) VALUES
 ('fd910000-0000-4000-8000-000000000003','F-TWENTY','Founder price','founders','discount',20,1);
SELECT lives_ok($$INSERT INTO public.ucat_founder_offers(code,name,campaign,kind,percent_off) VALUES ('F-FULL','Full founder discount','founders','discount',100)$$, 'administrator can explicitly offer a full percentage discount');
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000001'), 'free', 'student starts on Free');
SELECT is((public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000001',' f-one ','month')).status, 'reserved', 'free-time claim reserves checkout');
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000001'), 'free', 'reservation does not grant access');
SELECT ok((SELECT access_ends_at IS NULL AND redeemed_at IS NULL FROM public.ucat_founder_redemptions WHERE student_id='fd900000-0000-4000-8000-000000000001'), 'reservation has no redemption dates');
SELECT ok((SELECT ucat_unlimited_trial_consumed_at IS NULL FROM public.students WHERE id='fd900000-0000-4000-8000-000000000001'), 'reservation does not consume trial eligibility');
SELECT is((public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000001','F-ONE','month')).id,
 (SELECT id FROM public.ucat_founder_redemptions WHERE student_id='fd900000-0000-4000-8000-000000000001'), 'same interval retry returns reservation');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000001','F-ONE','year')$$,
 'P0001','You have already claimed this type of founder offer. Complete or cancel any open offer checkout first.', 'different interval requires replacing checkout');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-ONE','month')$$,
 'P0001','All places for this invitation have been claimed. Please try again later.', 'reservation holds capped place');
UPDATE public.ucat_founder_redemptions SET status='expired' WHERE student_id='fd900000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-ONE','year')$$, 'expired free-time checkout releases capped place');
UPDATE public.ucat_founder_redemptions SET status='redeemed', redeemed_at=now(), access_ends_at=now()+interval '14 days', stripe_subscription_id='sub_founder_test' WHERE student_id='fd900000-0000-4000-8000-000000000002';
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000002'), 'free', 'Stripe-backed redemption cannot grant independent access without an active subscription');
INSERT INTO public.student_subscriptions(student_id,subject_id,stripe_subscription_id,status,plan_tier,billing_interval)
 VALUES ('fd900000-0000-4000-8000-000000000002',public.get_ucat_subject_id(),'sub_founder_test','trialing','unlimited','year');
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000002'), 'unlimited', 'confirmed trial grants subscription access');
UPDATE public.student_subscriptions SET status='canceled' WHERE stripe_subscription_id='sub_founder_test';
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000002'), 'free', 'canceled trial cannot fall back to an independent pass');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-ONE','year')$$,
 'P0001','You have already claimed this type of founder offer. Complete or cancel any open offer checkout first.', 'completed free period cannot be reclaimed');
SELECT lives_ok($$SELECT public.reserve_ucat_checkout('fd900000-0000-4000-8000-000000000003','gift')$$, 'checkout locks student before claiming offer');
SELECT lives_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000003','F-MONTH','week')$$, 'free period reserves within checkout hold');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000007','F-MONTH')$$,
 'P0001','Choose a billing interval.', 'direct no-card redemption is disabled');
-- A previously redeemed no-card pass retains the exact promise made at redemption.
INSERT INTO public.ucat_founder_redemptions(offer_id,student_id,kind,status,redeemed_at,access_ends_at)
 VALUES ('fd910000-0000-4000-8000-000000000002','fd900000-0000-4000-8000-000000000008','access_pass','redeemed',now(),now()+interval '1 month');
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000008'), 'unlimited', 'historical no-card pass keeps original entitlement');
SELECT lives_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000001','F-TWENTY','year')$$, 'discount reserves a checkout');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-TWENTY','week')$$,
 'P0001','All places for this invitation have been claimed. Please try again later.', 'discount reservation holds capped place');
UPDATE public.ucat_founder_redemptions SET status='expired' WHERE kind='discount' AND student_id='fd900000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-TWENTY','week')$$, 'expired discount releases place');
UPDATE public.ucat_founder_redemptions SET status='redeemed', redeemed_at=now() WHERE kind='discount' AND student_id='fd900000-0000-4000-8000-000000000002';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-TWENTY','month')$$,
 'P0001','You have already claimed this type of founder offer. Complete or cancel any open offer checkout first.', 'ended discount cannot be reclaimed');
UPDATE public.ucat_founder_offers SET active=false WHERE code='F-MONTH';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000004','F-MONTH','month')$$,
 'P0001','This invitation code has expired or been disabled.', 'disabled code rejects future claims');
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000008'), 'unlimited', 'disabling code preserves historical access');
UPDATE public.ucat_founder_offers SET active=true, expires_at=now()-interval '1 second' WHERE code='F-MONTH';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000004','F-MONTH','month')$$,
 'P0001','This invitation code has expired or been disabled.', 'expired code rejects claims');
UPDATE public.ucat_founder_offers SET expires_at=NULL WHERE code='F-MONTH';
UPDATE public.students SET ucat_unlimited_trial_consumed_at=now() WHERE id='fd900000-0000-4000-8000-000000000004';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000004','F-MONTH','month')$$,
 'P0001','Free access offers cannot be combined with a previous trial or referral gift.', 'prior standard trial blocks another acquisition gift');
INSERT INTO public.student_subscriptions(student_id,subject_id,stripe_subscription_id,status,plan_tier,billing_interval)
 VALUES ('fd900000-0000-4000-8000-000000000005',public.get_ucat_subject_id(),'sub_founder_contract','active','unlimited','month');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000005','F-MONTH','month')$$,
 'P0001','Founder offers cannot be applied to an existing subscription.', 'paid student cannot claim pass');
UPDATE public.ucat_founder_offers SET max_redemptions=NULL WHERE code='F-TWENTY';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000005','F-TWENTY','month')$$,
 'P0001','Founder offers cannot be applied to an existing subscription.', 'paid student cannot apply discount');
SELECT lives_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000006','F-TWENTY','month')$$, 'unlimited code permits further claims');
SELECT ok(NOT has_function_privilege('authenticated','public.claim_ucat_founder_offer(uuid,text,text)','EXECUTE'), 'students cannot call privileged claims directly');
SELECT ok(NOT has_function_privilege('anon','public.reserve_ucat_checkout(uuid,text,boolean)','EXECUTE'), 'anonymous clients cannot reserve checkout');


SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.ucat_founder_offers), 0, 'non-admin cannot read offer inventory');
SELECT is((SELECT count(*)::integer FROM public.ucat_founder_redemptions), 0, 'non-admin cannot read redemptions');
WITH changed AS (UPDATE public.ucat_founder_redemptions SET status='redeemed' RETURNING id) SELECT is(count(*)::integer, 0, 'student cannot grant themselves redemptions even with broad local-seed privileges') FROM changed;
SELECT throws_ok($$INSERT INTO public.ucat_founder_offers(code,name,campaign,kind,percent_off) VALUES ('F-ATTACK','Unauthorized','attack','discount',90)$$,
 '42501', 'new row violates row-level security policy for table "ucat_founder_offers"', 'student cannot issue their own code');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('role','authenticated','sub',(SELECT user_id FROM public.staff WHERE role='ADMINSTAFF' AND status='ACTIVE' AND user_id IS NOT NULL ORDER BY id LIMIT 1))::text, true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.ucat_founder_offers(code,name,campaign,kind,percent_off) VALUES ('F-ADMIN','Admin offer','admin','discount',20)$$, 'active admin can issue an offer');
SELECT lives_ok($$INSERT INTO public.ucat_founder_offers(code,name,campaign,kind,percent_off) VALUES ('LAUNCH','Launch offer','launch','discount',15)$$, 'admin can issue a code that does not start with F-');
SELECT lives_ok($$UPDATE public.ucat_founder_offers SET active=false WHERE code='F-ADMIN'$$, 'admin can disable future claims');
SELECT throws_ok($$UPDATE public.ucat_founder_offers SET percent_off=90 WHERE code='F-ADMIN'$$,
 '42501', 'Offer terms are immutable; create a new code.', 'admin cannot rewrite commercial terms after creation');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
