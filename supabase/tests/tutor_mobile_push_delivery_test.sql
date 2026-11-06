BEGIN;
SELECT plan(15);

INSERT INTO auth.users (
  instance_id, id, aud, email, raw_app_meta_data, raw_user_meta_data, role
)
VALUES
  ((SELECT id FROM auth.instances LIMIT 1),
   'de220000-0000-4000-8000-000000000001', 'authenticated',
   'tutor.push.first@invalid.test', '{"provider":"email","providers":["email"]}', '{}', 'authenticated'),
  ((SELECT id FROM auth.instances LIMIT 1),
   'de220000-0000-4000-8000-000000000002', 'authenticated',
   'tutor.push.second@invalid.test', '{"provider":"email","providers":["email"]}', '{}', 'authenticated');

INSERT INTO public.staff (id, user_id, role, status, first_name, last_name, email)
VALUES
  ('de221000-0000-4000-8000-000000000001',
   'de220000-0000-4000-8000-000000000001', 'TUTOR', 'ACTIVE', 'First', 'Tutor', 'tutor.push.first@invalid.test'),
  ('de221000-0000-4000-8000-000000000002',
   'de220000-0000-4000-8000-000000000002', 'TUTOR', 'TRIAL', 'Second', 'Tutor', 'tutor.push.second@invalid.test');

INSERT INTO auth.sessions (id, user_id)
VALUES
  ('de224000-0000-4000-8000-000000000001', 'de220000-0000-4000-8000-000000000001'),
  ('de224000-0000-4000-8000-000000000002', 'de220000-0000-4000-8000-000000000002'),
  ('de224000-0000-4000-8000-000000000003', 'de220000-0000-4000-8000-000000000001');

INSERT INTO public.mobile_push_devices
  (id, staff_id, staff_user_id, staff_session_id, app_scope, expo_push_token, platform)
VALUES
  ('de222000-0000-4000-8000-000000000001', 'de221000-0000-4000-8000-000000000001',
   'de220000-0000-4000-8000-000000000001', 'de224000-0000-4000-8000-000000000001',
   'staff_web', 'ExpoPushToken[first-tutor]', 'ios'),
  ('de222000-0000-4000-8000-000000000002', 'de221000-0000-4000-8000-000000000002',
   'de220000-0000-4000-8000-000000000002', 'de224000-0000-4000-8000-000000000002',
   'staff_web', 'ExpoPushToken[second-tutor]', 'android');

INSERT INTO public.notifications (id, staff_id, app_scope, notification_type, title, dismissed_at)
VALUES
  ('de223000-0000-4000-8000-000000000001', 'de221000-0000-4000-8000-000000000001',
   'staff_web', 'STAFF_INBOX_UPDATE', 'Tutor update', NULL),
  ('de223000-0000-4000-8000-000000000002', 'de221000-0000-4000-8000-000000000002',
   'staff_web', 'STAFF_INBOX_UPDATE', 'Other tutor update', NULL),
  ('de223000-0000-4000-8000-000000000003', 'de221000-0000-4000-8000-000000000001',
   'student_web', 'STUDENT_ABSENCE_LOGGED', 'Wrong app', NULL),
  ('de223000-0000-4000-8000-000000000004', 'de221000-0000-4000-8000-000000000001',
   'staff_web', 'STAFF_INBOX_UPDATE', 'Dismissed tutor update', now());

SELECT results_eq(
  $$ SELECT device_id, category FROM public.mobile_push_deliveries
     WHERE notification_id = 'de223000-0000-4000-8000-000000000001' $$,
  $$ VALUES ('de222000-0000-4000-8000-000000000001'::uuid, 'tutor_updates'::text) $$,
  'staff inbox updates fan out to the recipient tutor device only'
);

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE notification_id IN ('de223000-0000-4000-8000-000000000003', 'de223000-0000-4000-8000-000000000004')),
  0::bigint, 'a staff notification in another inbox and a dismissed notice do not reach tutor devices');

INSERT INTO public.mobile_push_preferences (staff_id, app_scope, category, enabled)
VALUES ('de221000-0000-4000-8000-000000000001', 'staff_web', 'tutor_updates', false);

UPDATE public.staff SET status = 'INACTIVE' WHERE id = 'de221000-0000-4000-8000-000000000002';

CREATE TEMP TABLE tutor_test_send_claims AS SELECT * FROM public.claim_mobile_push_deliveries();
SELECT results_eq(
  $$ SELECT notification_id, preference_enabled FROM tutor_test_send_claims
     WHERE notification_id IN ('de223000-0000-4000-8000-000000000001', 'de223000-0000-4000-8000-000000000002')
     ORDER BY notification_id $$,
  $$ VALUES ('de223000-0000-4000-8000-000000000001'::uuid, false),
            ('de223000-0000-4000-8000-000000000002'::uuid, false) $$,
  'claim rechecks a changed preference and revoked portal access'
);

INSERT INTO public.notifications (id, staff_id, notification_type, title)
VALUES ('de223000-0000-4000-8000-000000000005', 'de221000-0000-4000-8000-000000000001',
        'STAFF_INBOX_UPDATE', 'Opted out');

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE notification_id = 'de223000-0000-4000-8000-000000000005'),
  0::bigint, 'an opted-out tutor does not receive new deliveries');

UPDATE public.mobile_push_devices SET updated_at = clock_timestamp()
WHERE id = 'de222000-0000-4000-8000-000000000001';

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE device_id = 'de222000-0000-4000-8000-000000000001'),
  1::bigint, 'refreshing the same login keeps its outstanding delivery');

SELECT is((
  SELECT public.retire_mobile_push_device(id, expo_push_token, 'sending', lease_expires_at + interval '1 second')
  FROM tutor_test_send_claims WHERE notification_id = 'de223000-0000-4000-8000-000000000001'
), false, 'a response cannot retire a device for a different claim lease');

UPDATE public.mobile_push_devices SET staff_session_id = 'de224000-0000-4000-8000-000000000003'
WHERE id = 'de222000-0000-4000-8000-000000000001';

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE device_id = 'de222000-0000-4000-8000-000000000001'),
  0::bigint, 're-registering on the same installation removes the previous login deliveries');

SELECT is((
  SELECT public.retire_mobile_push_device(id, expo_push_token, 'sending', lease_expires_at)
  FROM tutor_test_send_claims WHERE notification_id = 'de223000-0000-4000-8000-000000000001'
), false, 'a stale Expo response cannot retire the replacement login on the same token');

DELETE FROM auth.sessions WHERE id = 'de224000-0000-4000-8000-000000000002';

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE device_id = 'de222000-0000-4000-8000-000000000002'),
  0::bigint, 'revoking a tutor Auth session clears its pending deliveries');

SELECT is((SELECT count(*) FROM public.mobile_push_devices
  WHERE id = 'de222000-0000-4000-8000-000000000002'),
  0::bigint, 'revoking a tutor Auth session unregisters the device');

INSERT INTO public.mobile_push_devices (student_id, app_scope, expo_push_token, platform)
VALUES ('10000000-0000-0000-0000-000000000001', 'student_web', 'ExpoPushToken[first-tutor]', 'ios')
ON CONFLICT (expo_push_token) DO UPDATE
SET student_id = excluded.student_id, app_scope = excluded.app_scope, platform = excluded.platform;

SELECT results_eq(
  $$ SELECT student_id, staff_id, staff_user_id, staff_session_id, app_scope FROM public.mobile_push_devices
     WHERE expo_push_token = 'ExpoPushToken[first-tutor]' $$,
  $$ VALUES ('10000000-0000-0000-0000-000000000001'::uuid, NULL::uuid, NULL::uuid, NULL::uuid, 'student_web'::text) $$,
  'the existing student registration upsert also clears prior tutor ownership'
);

SELECT throws_ok(
  $$ INSERT INTO public.mobile_push_devices
       (student_id, staff_id, staff_user_id, staff_session_id, app_scope, expo_push_token, platform)
     VALUES ('10000000-0000-0000-0000-000000000001', 'de221000-0000-4000-8000-000000000001',
             'de220000-0000-4000-8000-000000000001', 'de224000-0000-4000-8000-000000000003',
             'staff_web', 'ExpoPushToken[invalid-recipient]', 'ios') $$,
  '23514', NULL, 'device scope and recipient cannot be mixed'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.mobile_push_devices', 'SELECT, INSERT, UPDATE, DELETE')
  AND NOT has_table_privilege('authenticated', 'public.mobile_push_preferences', 'SELECT, INSERT, UPDATE, DELETE'),
  'tutor JWTs cannot read or mutate push base tables'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_mobile_push_deliveries(integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.retire_mobile_push_device(uuid,text,text,timestamptz)', 'EXECUTE'),
  'only the service role can claim deliveries and retire devices'
);

INSERT INTO public.notifications (id, student_id, app_scope, notification_type, title)
VALUES ('de223000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000001',
  'student_web', 'STUDENT_ABSENCE_LOGGED', 'Student update');
UPDATE public.mobile_push_deliveries
SET status = 'ticket', ticket_id = 'tutor-test-receipt', receipt_due_at = now()
WHERE notification_id = 'de223000-0000-4000-8000-000000000006';

CREATE TEMP TABLE tutor_test_receipt_claims AS SELECT * FROM public.claim_mobile_push_receipts();
SELECT is((
  SELECT public.retire_mobile_push_device(id, expo_push_token, 'ticket', lease_expires_at)
  FROM tutor_test_receipt_claims WHERE ticket_id = 'tutor-test-receipt'
), true, 'a matching receipt claim retires the current unregistered device');

SELECT * FROM finish();
ROLLBACK;
