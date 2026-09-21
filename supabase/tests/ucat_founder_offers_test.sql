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
SELECT is((public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000001',' f-one ')).status, 'redeemed', 'claim normalizes code and grants no-card access');
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000001'), 'unlimited', 'pass grants Unlimited without a subscription');
SELECT is((SELECT count(*)::integer FROM public.student_subscriptions WHERE student_id='fd900000-0000-4000-8000-000000000001'), 0, 'pass never creates a billing subscription');
SELECT is((SELECT access_ends_at - redeemed_at FROM public.ucat_founder_redemptions WHERE student_id='fd900000-0000-4000-8000-000000000001'), interval '14 days', 'two weeks means fourteen days');
SELECT is((public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000001','F-ONE')).id,
 (SELECT id FROM public.ucat_founder_redemptions WHERE student_id='fd900000-0000-4000-8000-000000000001'), 'retry returns the original redemption');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-ONE')$$,
 'P0001','All places for this invitation have been claimed. Please try again later.', 'cap rejects a second student');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000001','F-MONTH')$$,
 'P0001','You have already claimed this type of founder offer. Complete or cancel any open offer checkout first.', 'different code cannot grant another pass');
UPDATE public.ucat_founder_redemptions SET redeemed_at=now()-interval '15 days', access_ends_at=now()-interval '1 day' WHERE student_id='fd900000-0000-4000-8000-000000000001';
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000001'), 'free', 'expired pass falls back to Free without a background job');
SELECT ok((SELECT ucat_unlimited_trial_consumed_at IS NOT NULL FROM public.students WHERE id='fd900000-0000-4000-8000-000000000001'), 'pass suppresses subsequent standard trial');
SELECT is((public.reserve_ucat_checkout('fd900000-0000-4000-8000-000000000001','paid')).suppress_trial, true, 'paid checkout after pass cannot chain a trial');
SELECT throws_ok($$SELECT public.reserve_ucat_checkout('fd900000-0000-4000-8000-000000000001','referral',true)$$,
 'P0001','Referral gifts cannot be combined with your access pass.', 'pass cannot chain a referral checkout');
SELECT lives_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000001','F-TWENTY','year')$$, 'pass recipient may subsequently use a founder discount');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-TWENTY','week')$$,
 'P0001','All places for this invitation have been claimed. Please try again later.', 'checkout reservation holds last discount place');
UPDATE public.ucat_founder_redemptions SET status='expired' WHERE kind='discount' AND student_id='fd900000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-TWENTY','week')$$, 'Stripe-confirmed expiry releases the place');
UPDATE public.ucat_founder_redemptions SET status='redeemed', redeemed_at=now() WHERE kind='discount' AND student_id='fd900000-0000-4000-8000-000000000002';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000002','F-TWENTY','month')$$,
 'P0001','You have already claimed this type of founder offer. Complete or cancel any open offer checkout first.', 'ended founder subscription cannot regain founder discount');
SELECT lives_ok($$SELECT public.reserve_ucat_checkout('fd900000-0000-4000-8000-000000000003','trial')$$, 'ordinary checkout reserves student before contacting Stripe');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000003','F-MONTH')$$,
 'P0001','Cancel your open checkout before starting a free access pass.', 'open checkout excludes a concurrent pass');
DELETE FROM public.ucat_checkout_holds WHERE student_id='fd900000-0000-4000-8000-000000000003';
SELECT lives_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000003','F-MONTH')$$, 'cancelling open checkout permits pass redemption');
SELECT is((SELECT access_ends_at FROM public.ucat_founder_redemptions WHERE student_id='fd900000-0000-4000-8000-000000000003'), now()+interval '1 month', 'month offers use calendar months');
UPDATE public.ucat_founder_offers SET active=false WHERE code='F-MONTH';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000004','F-MONTH')$$,
 'P0001','This invitation code has expired or been disabled.', 'disabled code rejects future claims');
SELECT is(public.get_student_ucat_online_tier('fd900000-0000-4000-8000-000000000003'), 'unlimited', 'disabling code preserves already granted access');
UPDATE public.ucat_founder_offers SET active=true, expires_at=now()-interval '1 second' WHERE code='F-MONTH';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000004','F-MONTH')$$,
 'P0001','This invitation code has expired or been disabled.', 'expired code rejects claims');
UPDATE public.ucat_founder_offers SET expires_at=NULL WHERE code='F-MONTH';
UPDATE public.students SET ucat_unlimited_trial_consumed_at=now() WHERE id='fd900000-0000-4000-8000-000000000004';
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000004','F-MONTH')$$,
 'P0001','Free access offers cannot be combined with a previous trial or referral gift.', 'prior standard trial blocks another acquisition gift');
INSERT INTO public.student_subscriptions(student_id,subject_id,stripe_subscription_id,status,plan_tier,billing_interval)
 VALUES ('fd900000-0000-4000-8000-000000000005',public.get_ucat_subject_id(),'sub_founder_contract','active','unlimited','month');
SELECT throws_ok($$SELECT public.claim_ucat_founder_offer('fd900000-0000-4000-8000-000000000005','F-MONTH')$$,
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
