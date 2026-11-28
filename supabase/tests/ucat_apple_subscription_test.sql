BEGIN;
SELECT no_plan();
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
INSERT INTO public.students(id,first_name,last_name) VALUES ('aa531000-0000-4000-8000-000000000001','Apple','Demo');
SELECT lives_ok($$SELECT public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001')$$, 'server can establish a durable purchase binding');
SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'),
  'environment','Production','originalTransactionId','531001','transactionId','531002',
  'productId','com.altitutor.ucat.unlimited.monthly','status',1,
  'accessUntil',now()+interval '1 day','signedAt',now()), now(), false);
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'unlimited', 'verified Apple purchase grants shared Unlimited access');
SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'),
  'environment','Production','originalTransactionId','531001','transactionId','531002',
  'productId','com.altitutor.ucat.unlimited.monthly','status',5,
  'accessUntil',NULL,'signedAt',now()), now()+interval '1 second', false);
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'free', 'revocation removes Apple access');
SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'),
  'environment','Production','originalTransactionId','531001','transactionId','531002',
  'productId','com.altitutor.ucat.unlimited.monthly','status',1,
  'accessUntil',now()+interval '1 day','signedAt',now()-interval '1 second'), now()+interval '2 seconds', false);
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'free', 'later-observed older-signed Apple state cannot undo revocation');
SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'),
  'environment','Production','originalTransactionId','531001','transactionId','531002',
  'productId','com.altitutor.ucat.unlimited.monthly','status',1,
  'accessUntil',now()+interval '1 day','signedAt',now()), now(), false);
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'free', 'older response cannot replay revoked access');
INSERT INTO public.student_subscriptions(student_id,subject_id,stripe_subscription_id,status,plan_tier,billing_interval)
 VALUES ('aa531000-0000-4000-8000-000000000001',public.get_ucat_subject_id(),'sub_apple_contract','active','unlimited','month');
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'unlimited', 'Apple revocation cannot remove valid Stripe access');
UPDATE public.students SET ucat_online_tier_override='force_free' WHERE id='aa531000-0000-4000-8000-000000000001';
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'free', 'administrator Free override remains authoritative');
SELECT ok(NOT has_function_privilege('authenticated','public.record_ucat_apple_subscription(jsonb,timestamptz,boolean)','EXECUTE'), 'clients cannot forge purchase grants');
SELECT ok(NOT has_table_privilege('authenticated','public.ucat_apple_accounts','SELECT'), 'clients cannot read other purchase bindings');
INSERT INTO auth.users(id,email,aud,role) VALUES ('aa531100-0000-4000-8000-000000000001','apple-contract@example.test','authenticated','authenticated');
UPDATE public.students SET user_id='aa531100-0000-4000-8000-000000000001' WHERE id='aa531000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"aa531100-0000-4000-8000-000000000001"}', true);
SELECT results_eq('SELECT count(*)::integer FROM public.vstudent_ucat_apple_subscriptions', ARRAY[1], 'student facade exposes only the caller subscription');
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"aa531100-0000-4000-8000-000000000002"}', true);
SELECT results_eq('SELECT count(*)::integer FROM public.vstudent_ucat_apple_subscriptions', ARRAY[0], 'another account cannot read the purchase');
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.students SET ucat_online_tier_override='default' WHERE id='aa531000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.prepare_ucat_apple_purchase('aa531000-0000-4000-8000-000000000001','com.altitutor.ucat.unlimited.monthly')$$, 'P0001', 'You already have a subscription.', 'Apple checkout rejects an existing Stripe subscription');
UPDATE public.student_subscriptions SET status='canceled' WHERE stripe_subscription_id='sub_apple_contract';
SELECT is(public.prepare_ucat_apple_purchase('aa531000-0000-4000-8000-000000000001','com.altitutor.ucat.unlimited.monthly'), public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'), 'free account prepares its durable Apple token');
SELECT throws_ok($$SELECT public.reserve_ucat_checkout('aa531000-0000-4000-8000-000000000001','stripe-contract')$$, 'P0001', 'Cancel your open checkout before changing your selection.', 'pending Apple checkout blocks a simultaneous Stripe checkout');
SELECT public.release_ucat_apple_checkout('aa531000-0000-4000-8000-000000000001');
SELECT lives_ok($$SELECT public.reserve_ucat_checkout('aa531000-0000-4000-8000-000000000001','stripe-contract')$$, 'releasing cancelled Apple checkout permits website checkout');
SELECT public.release_ucat_apple_checkout('aa531000-0000-4000-8000-000000000001');
SELECT throws_ok($$SELECT public.prepare_ucat_apple_purchase('aa531000-0000-4000-8000-000000000001','com.altitutor.ucat.unlimited.monthly')$$, 'P0001', 'Cancel your open checkout before changing your selection.', 'Apple cancellation cannot clear a Stripe checkout hold');
SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'),
  'environment','Sandbox','originalTransactionId','531003','transactionId','531004',
  'productId','com.altitutor.ucat.unlimited.monthly','status',1,
  'accessUntil',now()+interval '1 day','signedAt',now()), now(), false);
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'free', 'sandbox purchase cannot grant ordinary production access');
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"aa531100-0000-4000-8000-000000000001"}', true);
SET LOCAL ROLE authenticated;
SELECT results_eq('SELECT count(*)::integer FROM public.vstudent_ucat_apple_subscriptions', ARRAY[1], 'actual Student role can read its production facade without sandbox leakage');
SELECT throws_ok('SELECT * FROM public.ucat_apple_subscriptions', '42501', 'permission denied for table ucat_apple_subscriptions', 'actual Student role cannot read the billing base table');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
INSERT INTO public.students(id,first_name,last_name) VALUES ('aa531000-0000-4000-8000-000000000002','Other','Account');
SELECT throws_ok($$SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000002'),
  'environment','Production','originalTransactionId','531001','transactionId','531002',
  'productId','com.altitutor.ucat.unlimited.monthly','status',1,
  'accessUntil',now()+interval '1 day','signedAt',now()), now()+interval '10 seconds', false)$$,
  'P0001','Apple purchase belongs to another account','restore cannot transfer an original purchase to another Student');
SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'),
  'environment','Production','originalTransactionId','531001','transactionId','531006',
  'productId','com.altitutor.ucat.unlimited.monthly','status',1,
  'accessUntil',now()-interval '1 second','signedAt',now()), now()+interval '11 seconds', false);
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'free', 'expired access ends without waiting for a notification');
SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'),
  'environment','Production','originalTransactionId','531001','transactionId','531007',
  'productId','com.altitutor.ucat.unlimited.monthly','status',1,
  'accessUntil',now()+interval '1 day','signedAt',now()), now()+interval '12 seconds', false);
SELECT throws_ok($$SELECT public.reserve_ucat_checkout('aa531000-0000-4000-8000-000000000001','stripe-contract')$$,
  'P0001','You already have an Apple subscription.','active Apple subscriber cannot start Stripe checkout');
SELECT public.record_ucat_apple_subscription(jsonb_build_object(
  'accountToken', public.ensure_ucat_apple_account('aa531000-0000-4000-8000-000000000001'),
  'environment','Production','originalTransactionId','531001','transactionId','531007',
  'productId','com.altitutor.ucat.unlimited.monthly','status',5,
  'accessUntil',NULL,'signedAt',now()+interval '1 second'), now()+interval '5 seconds', false);
SELECT is(public.get_student_ucat_online_tier('aa531000-0000-4000-8000-000000000001'), 'free', 'newer-signed revocation wins even when its request began earlier');
SELECT * FROM finish();
ROLLBACK;
