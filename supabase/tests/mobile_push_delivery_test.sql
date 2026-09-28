BEGIN;

SELECT plan(10);

-- UCAT fixtures may have already selected today's first content notice.
DELETE FROM public.mobile_push_content_days
WHERE student_id = '10000000-0000-0000-0000-000000000002';

INSERT INTO public.mobile_push_devices
  (id, student_id, app_scope, expo_push_token, platform)
VALUES
  ('de000000-0000-4000-8000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'student_web',
   'ExpoPushToken[student-test]', 'ios'),
  ('de000000-0000-4000-8000-000000000002',
   '10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ExpoPushToken[ucat-test]', 'android');

SELECT is(public.mobile_push_category('student_web', 'STUDENT_ABSENCE_LOGGED'),
  'sessions', 'student absence maps to Sessions');
SELECT is(public.mobile_push_category('ucat_web', 'ucat.exam_attempt.expired'),
  NULL::text, 'attempt expiry remains inbox-only');

INSERT INTO public.notifications
  (id, student_id, app_scope, notification_type, title)
VALUES
  ('de100000-0000-4000-8000-000000000001',
   '10000000-0000-0000-0000-000000000001', 'student_web',
   'STUDENT_ABSENCE_LOGGED', 'Absence'),
  ('de100000-0000-4000-8000-000000000002',
   '10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ucat.quota.limit_reached', 'Limit'),
  ('de100000-0000-4000-8000-000000000003',
   '10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ucat.quota_reset.granted', 'Grant');

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE notification_id = 'de100000-0000-4000-8000-000000000001'),
  1::bigint, 'student Sessions pushes default on');
SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE notification_id = 'de100000-0000-4000-8000-000000000002'),
  0::bigint, 'UCAT Quota-limit alerts default off');
SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE notification_id = 'de100000-0000-4000-8000-000000000003'),
  1::bigint, 'UCAT Quota grants default on');

INSERT INTO public.mobile_push_preferences
  (student_id, app_scope, category, enabled)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'ucat_web', 'quota_limits', true),
  ('10000000-0000-0000-0000-000000000002', 'ucat_web', 'new_content', true);

INSERT INTO public.notifications
  (id, student_id, app_scope, notification_type, title, dedupe_key)
VALUES
  ('de100000-0000-4000-8000-000000000004',
   '10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ucat.quota.limit_reached', 'Limit', 'push-test-limit'),
  ('de100000-0000-4000-8000-000000000005',
   '10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ucat.content.sets_released', 'New sets', 'push-test-content');

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE notification_id = 'de100000-0000-4000-8000-000000000004'),
  1::bigint, 'opted-in quota limit enqueues a push');

INSERT INTO public.notifications
  (student_id, app_scope, notification_type, title, dedupe_key)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ucat.content.sets_released', 'More sets', 'push-test-content')
ON CONFLICT (dedupe_key) DO UPDATE SET title = excluded.title;

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE notification_id = 'de100000-0000-4000-8000-000000000005'),
  1::bigint, 'an aggregated content inbox row enqueues only one push');

INSERT INTO public.notifications
  (id, student_id, app_scope, notification_type, title)
VALUES
  ('de100000-0000-4000-8000-000000000006',
   '10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ucat.content.mocks_released', 'New mocks');

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE device_id = 'de000000-0000-4000-8000-000000000002'
    AND category = 'new_content'),
  1::bigint, 'new content sends at most once per category per Adelaide day');

INSERT INTO public.mobile_push_devices
  (id, student_id, app_scope, expo_push_token, platform)
VALUES
  ('de000000-0000-4000-8000-000000000003',
   '10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ExpoPushToken[ucat-new-device]', 'ios');
INSERT INTO public.notifications
  (student_id, app_scope, notification_type, title)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'ucat_web',
   'ucat.content.learning_released', 'New lessons');
SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE device_id = 'de000000-0000-4000-8000-000000000003'
    AND category = 'new_content'),
  0::bigint, 'a device registered later cannot cause a second daily content push');

UPDATE public.mobile_push_devices
SET student_id = '10000000-0000-0000-0000-000000000002'
WHERE id = 'de000000-0000-4000-8000-000000000001';

SELECT is((SELECT count(*) FROM public.mobile_push_deliveries
  WHERE notification_id = 'de100000-0000-4000-8000-000000000001'),
  0::bigint, 'reassigning a token clears the previous student push');

SELECT * FROM finish();
ROLLBACK;
