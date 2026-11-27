BEGIN;
SELECT plan(27);

INSERT INTO public.contacts (id, phone_e164, email, contact_type) VALUES
  ('f9600000-0000-4000-8000-000000000001', '+61400996901', 'scheduled-recipient@example.test', 'OTHER'),
  ('f9600000-0000-4000-8000-000000000002', '+61400996902', NULL, 'OTHER');
INSERT INTO public.owned_numbers (id, phone_e164, provider)
VALUES ('f9600000-0000-4000-8000-000000000003', '+61400996903', 'IMESSAGE');
INSERT INTO public.conversations (id, contact_id, owned_number_id) VALUES
  ('f9600000-0000-4000-8000-000000000004', 'f9600000-0000-4000-8000-000000000001', 'f9600000-0000-4000-8000-000000000003'),
  ('f9600000-0000-4000-8000-000000000005', 'f9600000-0000-4000-8000-000000000002', 'f9600000-0000-4000-8000-000000000003');

SELECT ok(NOT has_function_privilege('anon',
  'public.create_scheduled_admin_text(uuid,text,text,timestamptz,text,jsonb,uuid,uuid,text,uuid)', 'EXECUTE'),
  'Anonymous callers cannot execute the scheduled enqueue RPC');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000001"}', true);
SELECT throws_ok($$
  SELECT public.create_scheduled_admin_text(
    'f9600000-0000-4000-8000-000000000004', 'No student send', '+61400996901', now() + interval '1 hour')
$$, '42501', 'Active ADMINSTAFF required', 'A Student cannot schedule a text');
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}', true);
SELECT throws_ok($$
  SELECT public.create_scheduled_admin_text(
    'f9600000-0000-4000-8000-000000000004', 'No backdated send', '+61400996901', now() - interval '1 second')
$$, '22023', 'Choose a future time to schedule this text.', 'Admin enqueue requires a future time');
SELECT throws_ok($$
  SELECT public.create_scheduled_admin_text(
    'f9600000-0000-4000-8000-000000000004', 'Incomplete attachment', '+61400996901',
    now() + interval '1 hour', p_attachments := '[{"filename":"missing-url"}]')
$$, '23502', NULL, 'Broken attachment metadata aborts enqueue');
SELECT is((SELECT count(*) FROM public.messages
  WHERE conversation_id = 'f9600000-0000-4000-8000-000000000004' AND body = 'Incomplete attachment'),
  0::bigint, 'Attachment failure leaves no message for cron to dispatch');
SELECT set_config('scheduled_text_test.message', public.create_scheduled_admin_text(
  'f9600000-0000-4000-8000-000000000004', 'Scheduled via Admin', 'scheduled-recipient@example.test',
  now() + interval '1 hour', '+61400996903',
  '[{"storage_url":"messages-media/scheduled-test.pdf","filename":"scheduled.pdf","mime_type":"application/pdf","size_bytes":123}]'
)::text, true);

SELECT is((SELECT created_by_staff_id FROM public.messages WHERE id = current_setting('scheduled_text_test.message')::uuid),
  '00000000-0000-0000-0000-000000000001'::uuid, 'The persisted message is attributed to the active Admin');
SELECT is((SELECT storage_url FROM public.message_attachments WHERE message_id = current_setting('scheduled_text_test.message')::uuid),
  'messages-media/scheduled-test.pdf', 'Attachment metadata commits with the scheduled message');
SELECT is((SELECT scheduled_message_at FROM public.conversations WHERE id = 'f9600000-0000-4000-8000-000000000004'),
  now() + interval '1 hour', 'The conversation reflects its scheduled send time');
SELECT is((SELECT last_message_at FROM public.conversations WHERE id = 'f9600000-0000-4000-8000-000000000004'),
  NULL::timestamptz, 'A scheduled text is not yet the latest substantive message');
SELECT set_config('scheduled_text_test.retry', public.create_scheduled_admin_text(
  'f9600000-0000-4000-8000-000000000004', 'Retry-safe text', '+61400996901',
  now() + interval '1 hour', p_message_id := 'f9600000-0000-4000-8000-000000000011'
)::text, true);
SELECT is(public.create_scheduled_admin_text(
  'f9600000-0000-4000-8000-000000000004', 'Retry-safe text', '+61400996901',
  now() + interval '1 hour', p_message_id := 'f9600000-0000-4000-8000-000000000011'
), current_setting('scheduled_text_test.retry')::uuid, 'Replaying the enqueue returns the same message');
SELECT is((SELECT count(*) FROM public.messages WHERE body = 'Retry-safe text'),
  1::bigint, 'A replay schedules only one text');
UPDATE public.messages SET status = 'CANCELED'
WHERE id = 'f9600000-0000-4000-8000-000000000011' AND status = 'SCHEDULED';
SELECT throws_ok($$
  SELECT public.create_scheduled_admin_text(
    'f9600000-0000-4000-8000-000000000004', 'Retry-safe text', '+61400996901',
    now() + interval '1 hour', p_message_id := 'f9600000-0000-4000-8000-000000000011')
$$, '22023', 'This scheduled text was already canceled.', 'A retry cannot revive a canceled text');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.imessage_commands WHERE message_id = current_setting('scheduled_text_test.message')::uuid),
  0::bigint, 'A scheduled insert does not enqueue a bridge command');

-- Even if an early command exists, only an already released due text can be claimed.
SELECT set_config('scheduled_text_test.command',
  (public.ensure_imessage_send_command(current_setting('scheduled_text_test.message')::uuid)).id::text, true);
SELECT is((SELECT count(*) FROM public.claim_imessage_commands('scheduled-text-test') AS item
  WHERE item->>'id' = current_setting('scheduled_text_test.command')),
  0::bigint, 'An early command cannot claim a future text');
UPDATE public.messages SET scheduled_at = now() - interval '1 minute'
  WHERE id = current_setting('scheduled_text_test.message')::uuid;
SELECT is((SELECT count(*) FROM public.claim_imessage_commands('scheduled-text-test') AS item
  WHERE item->>'id' = current_setting('scheduled_text_test.command')),
  0::bigint, 'An early command cannot claim a due text before dispatch releases it');
UPDATE public.messages SET status = 'SENDING', status_updated_at = now()
  WHERE id = current_setting('scheduled_text_test.message')::uuid;
SELECT is((SELECT scheduled_dispatch_at FROM public.messages WHERE id = current_setting('scheduled_text_test.message')::uuid),
  now(), 'A released text records dispatch time separately from draft creation');
SELECT ok((SELECT scheduled_dispatch_at >= created_at FROM public.messages WHERE id = current_setting('scheduled_text_test.message')::uuid),
  'Scheduled history can page by dispatch even when the draft was created earlier');
CREATE TEMP TABLE scheduled_text_claim AS
SELECT item FROM public.claim_imessage_commands('scheduled-text-test', 100) AS item
WHERE item->>'id' = current_setting('scheduled_text_test.command');
SELECT is((SELECT item->'payload'->>'to' FROM scheduled_text_claim), 'scheduled-recipient@example.test',
  'The connector claims the selected Apple ID when the contact also has a phone');
SELECT is((SELECT item->'payload'->>'chatGuid' FROM scheduled_text_claim), 'iMessage;-;scheduled-recipient@example.test',
  'The connector chat identifier also uses the selected Apple ID');
SELECT is((SELECT count(*) FROM public.claim_imessage_commands('scheduled-text-test') AS item
  WHERE item->>'id' = current_setting('scheduled_text_test.command')),
  0::bigint, 'A second connector invocation cannot claim the same command');

INSERT INTO public.messages (id, conversation_id, direction, status, body, from_number_e164, to_number_e164, scheduled_at)
VALUES ('f9600000-0000-4000-8000-000000000006', 'f9600000-0000-4000-8000-000000000004',
  'OUTBOUND', 'SENDING', 'Initially valid scheduled recipient', '+61400996903', 'scheduled-recipient@example.test', now() - interval '1 minute');
SELECT set_config('scheduled_text_test.changed_command',
  (public.ensure_imessage_send_command('f9600000-0000-4000-8000-000000000006')).id::text, true);
UPDATE public.contacts SET email = 'replacement-recipient@example.test'
WHERE id = 'f9600000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*) FROM public.claim_imessage_commands('scheduled-text-test') AS item
  WHERE item->>'id' = current_setting('scheduled_text_test.changed_command')),
  0::bigint, 'The connector never receives a text whose scheduled recipient changed');
SELECT is((SELECT status FROM public.imessage_commands WHERE id = current_setting('scheduled_text_test.changed_command')::uuid),
  'failed', 'A changed recipient makes the command terminal rather than silently retrying');
SELECT is((SELECT status FROM public.messages WHERE id = 'f9600000-0000-4000-8000-000000000006'),
  'FAILED', 'The original scheduled message records the delivery failure');

INSERT INTO public.messages (id, conversation_id, direction, status, body, from_number_e164, to_number_e164, scheduled_at)
VALUES ('f9600000-0000-4000-8000-000000000007', 'f9600000-0000-4000-8000-000000000004',
  'OUTBOUND', 'SCHEDULED', 'Pending move', '+61400996903', '+61400996901', now() + interval '2 hours');
UPDATE public.messages SET conversation_id = 'f9600000-0000-4000-8000-000000000005'
WHERE id = 'f9600000-0000-4000-8000-000000000007';
SELECT is((SELECT scheduled_message_at FROM public.conversations WHERE id = 'f9600000-0000-4000-8000-000000000004'),
  NULL::timestamptz, 'Moving a scheduled message clears the old conversation projection');
SELECT is((SELECT scheduled_message_at FROM public.conversations WHERE id = 'f9600000-0000-4000-8000-000000000005'),
  now() + interval '2 hours', 'Moving a scheduled message updates the new conversation projection');

INSERT INTO public.messages (id, conversation_id, direction, status, body, from_number_e164, to_number_e164)
VALUES ('f9600000-0000-4000-8000-000000000008', 'f9600000-0000-4000-8000-000000000004',
  'OUTBOUND', 'QUEUED', 'Ordinary send', '+61400996903', 'replacement-recipient@example.test');
SELECT is((SELECT item->'payload'->>'to' FROM public.claim_imessage_commands('scheduled-text-test', 100) AS item
  WHERE (item->>'id')::uuid = (SELECT id FROM public.imessage_commands WHERE message_id = 'f9600000-0000-4000-8000-000000000008')),
  '+61400996901', 'Ordinary bridge claims preserve the existing phone-first behavior');

INSERT INTO public.messages (id, conversation_id, direction, status, body, from_number_e164, to_number_e164, created_at)
VALUES
  ('f9600000-0000-4000-8000-000000000009', 'f9600000-0000-4000-8000-000000000005',
    'OUTBOUND', 'SENT', 'Earlier ordinary message', '+61400996903', '+61400996902', now() - interval '30 minutes'),
  ('f9600000-0000-4000-8000-000000000010', 'f9600000-0000-4000-8000-000000000005',
    'INBOUND', 'RECEIVED', 'Latest substantive message', '+61400996902', '+61400996903', now() - interval '10 minutes');
UPDATE public.messages SET status = 'DELIVERED', status_updated_at = now()
WHERE id = 'f9600000-0000-4000-8000-000000000009';
SELECT is((SELECT last_message_id FROM public.conversations WHERE id = 'f9600000-0000-4000-8000-000000000005'),
  'f9600000-0000-4000-8000-000000000010'::uuid, 'Late ordinary delivery updates preserve the newer inbound conversation tip');

SELECT * FROM finish();
ROLLBACK;
