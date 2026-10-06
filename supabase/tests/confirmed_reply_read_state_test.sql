BEGIN;
SELECT plan(18);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

CREATE TEMP TABLE badge_baseline AS SELECT public.get_unread_contact_conversation_count() AS count;

INSERT INTO public.staff (id, first_name, last_name, role, status)
VALUES ('fa740000-0000-4000-8000-000000000080', 'Reply', 'Sender', 'ADMINSTAFF', 'ACTIVE');
INSERT INTO public.contacts (id, phone_e164, contact_type)
VALUES ('fa740000-0000-4000-8000-000000000081', '+61400999980', 'OTHER');
INSERT INTO public.owned_numbers (id, phone_e164, provider)
VALUES ('fa740000-0000-4000-8000-000000000082', '+61400999981', 'TWILIO');
INSERT INTO public.conversations (id, contact_id, owned_number_id)
VALUES ('fa740000-0000-4000-8000-000000000083', 'fa740000-0000-4000-8000-000000000081', 'fa740000-0000-4000-8000-000000000082');
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, created_at)
VALUES ('fa740000-0000-4000-8000-000000000083', 'INBOUND', 'Question', '+61400999980', '+61400999981', 'RECEIVED', now() - interval '2 minutes');
INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id, created_at)
VALUES ('fa740000-0000-4000-8000-000000000084', 'fa740000-0000-4000-8000-000000000083', 'OUTBOUND', 'Reply', '+61400999981', '+61400999980', 'QUEUED', 'fa740000-0000-4000-8000-000000000080', now() - interval '1 minute');

SELECT is((SELECT count(*) FROM public.conversation_reads WHERE conversation_id = 'fa740000-0000-4000-8000-000000000083'), 0::bigint, 'queueing does not mark read');
SELECT is(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid]), ARRAY['fa740000-0000-4000-8000-000000000083'::uuid], 'outbound queueing does not hide unread');
SELECT is(public.get_unread_contact_conversation_count(), (SELECT count + 1 FROM badge_baseline), 'navbar still counts the queued reply as unread');
UPDATE public.messages SET status = 'SENDING' WHERE id = 'fa740000-0000-4000-8000-000000000084';
SELECT is((SELECT count(*) FROM public.conversation_reads WHERE conversation_id = 'fa740000-0000-4000-8000-000000000083'), 0::bigint, 'sending does not mark read');
UPDATE public.messages SET status = 'FAILED' WHERE id = 'fa740000-0000-4000-8000-000000000084';
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid])), 1, 'failed reply stays unread');
UPDATE public.messages SET status = 'UNDELIVERED' WHERE id = 'fa740000-0000-4000-8000-000000000084';
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid])), 1, 'undelivered reply stays unread');
SET LOCAL ROLE service_role;
UPDATE public.messages SET status = 'SENT' WHERE id = 'fa740000-0000-4000-8000-000000000084';
RESET ROLE;
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid])), 0, 'provider-confirmed send marks read');
SELECT is(public.get_unread_contact_conversation_count(), (SELECT count FROM badge_baseline), 'navbar clears only after send confirmation');
SELECT is((SELECT auto_read_message_id FROM public.conversation_reads WHERE conversation_id = 'fa740000-0000-4000-8000-000000000083'), 'fa740000-0000-4000-8000-000000000084'::uuid, 'read records which reply cleared it');
UPDATE public.messages SET status = 'DELIVERED' WHERE id = 'fa740000-0000-4000-8000-000000000084';
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid])), 0, 'delivered stays read');
UPDATE public.messages SET status = 'UNDELIVERED' WHERE id = 'fa740000-0000-4000-8000-000000000084';
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid])), 1, 'late failure restores automatic unread');
UPDATE public.messages SET status = 'SENT' WHERE id = 'fa740000-0000-4000-8000-000000000084';
UPDATE public.conversation_reads SET auto_read_message_id = null, last_read_at = now() WHERE conversation_id = 'fa740000-0000-4000-8000-000000000083';
UPDATE public.messages SET status = 'UNDELIVERED' WHERE id = 'fa740000-0000-4000-8000-000000000084';
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid])), 0, 'manual read survives delivery failure');
DELETE FROM public.conversation_reads WHERE conversation_id = 'fa740000-0000-4000-8000-000000000083';
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, created_at)
VALUES ('fa740000-0000-4000-8000-000000000083', 'INBOUND', 'New question', '+61400999980', '+61400999981', 'RECEIVED', now());
UPDATE public.messages SET status = 'SENT' WHERE id = 'fa740000-0000-4000-8000-000000000084';
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid])), 1, 'late confirmation does not read a newer inbound');

-- Newer successful replies own the read marker, so an older failure cannot undo them.
INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id, created_at)
VALUES ('fa740000-0000-4000-8000-000000000085', 'fa740000-0000-4000-8000-000000000083', 'OUTBOUND', 'New reply', '+61400999981', '+61400999980', 'DELIVERED', 'fa740000-0000-4000-8000-000000000080', now() + interval '1 second');
UPDATE public.messages SET status = 'FAILED' WHERE id = 'fa740000-0000-4000-8000-000000000084';
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY['fa740000-0000-4000-8000-000000000083'::uuid])), 0, 'older failure does not undo a newer successful reply');
DELETE FROM public.conversation_reads WHERE conversation_id = 'fa740000-0000-4000-8000-000000000083';
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id, is_reaction, is_historical_import)
VALUES
('fa740000-0000-4000-8000-000000000083', 'OUTBOUND', 'Reaction', '+61400999981', '+61400999980', 'SENT', 'fa740000-0000-4000-8000-000000000080', true, false),
('fa740000-0000-4000-8000-000000000083', 'OUTBOUND', 'History', '+61400999981', '+61400999980', 'SENT', 'fa740000-0000-4000-8000-000000000080', false, true),
('fa740000-0000-4000-8000-000000000083', 'OUTBOUND', 'Device', '+61400999981', '+61400999980', 'SENT', null, false, false);
SELECT is((SELECT count(*) FROM public.conversation_reads WHERE conversation_id = 'fa740000-0000-4000-8000-000000000083'), 0::bigint, 'reactions, history and device sends do not auto read');

UPDATE public.conversations SET contact_id = null, is_group_chat = true, group_chat_id = 'reply-test-group' WHERE id = 'fa740000-0000-4000-8000-000000000083';
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id, created_at)
VALUES ('fa740000-0000-4000-8000-000000000083', 'OUTBOUND', 'Group reply', '+61400999981', '+61400999980', 'SENT', 'fa740000-0000-4000-8000-000000000080', now() + interval '2 seconds');
SELECT is((SELECT count(*) FROM public.conversation_reads WHERE conversation_id = 'fa740000-0000-4000-8000-000000000083'), 1::bigint, 'successful group reply marks group read');
SELECT is(cardinality(public.get_unread_message_conversation_ids(ARRAY[]::uuid[])), 0, 'empty list returns no unread conversations');
SELECT throws_ok($$SELECT public.get_unread_message_conversation_ids() FROM (SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true)) AS claims$$, 'P0001', 'not authorized', 'tutors cannot query admin unread state');
SELECT * FROM finish();
ROLLBACK;
