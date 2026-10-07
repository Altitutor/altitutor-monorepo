BEGIN;
SELECT plan(9);

INSERT INTO public.staff (id, first_name, last_name, role, status)
VALUES ('fa740000-0000-4000-8000-000000000090', 'Sender', 'Test', 'ADMINSTAFF', 'ACTIVE');
INSERT INTO public.contacts (id, phone_e164, contact_type)
VALUES ('fa740000-0000-4000-8000-000000000091', '+61400999990', 'OTHER');
INSERT INTO public.owned_numbers (id, phone_e164, provider)
VALUES ('fa740000-0000-4000-8000-000000000092', '+61400999991', 'TWILIO');
INSERT INTO public.conversations (id, contact_id, owned_number_id)
VALUES ('fa740000-0000-4000-8000-000000000093', 'fa740000-0000-4000-8000-000000000091', 'fa740000-0000-4000-8000-000000000092');
INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id)
VALUES ('fa740000-0000-4000-8000-000000000094', 'fa740000-0000-4000-8000-000000000093', 'OUTBOUND', 'Delivery test', '+61400999991', '+61400999990', 'SENT', 'fa740000-0000-4000-8000-000000000090');

SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id = 'fa740000-0000-4000-8000-000000000090'), 0::bigint, 'successful send does not notify');
SET LOCAL ROLE service_role;
UPDATE public.messages SET status = 'UNDELIVERED' WHERE id = 'fa740000-0000-4000-8000-000000000094';
RESET ROLE;
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id = 'fa740000-0000-4000-8000-000000000090'), 1::bigint, 'late failure notifies the sender');
SELECT is((SELECT action_url FROM public.notifications WHERE staff_id = 'fa740000-0000-4000-8000-000000000090'), '/messages?contact=fa740000-0000-4000-8000-000000000091', 'notification opens the failed conversation');
SELECT is((SELECT app_scope FROM public.notifications WHERE staff_id = 'fa740000-0000-4000-8000-000000000090'), 'staff_web', 'notification belongs to staff inbox');
UPDATE public.messages SET status = 'FAILED' WHERE id = 'fa740000-0000-4000-8000-000000000094';
UPDATE public.messages SET status = 'FAILED' WHERE id = 'fa740000-0000-4000-8000-000000000094';
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id = 'fa740000-0000-4000-8000-000000000090'), 1::bigint, 'repeated callbacks do not duplicate alerts');

INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id, is_historical_import)
VALUES
('fa740000-0000-4000-8000-000000000093', 'OUTBOUND', 'Imported failure', '+61400999991', '+61400999990', 'FAILED', 'fa740000-0000-4000-8000-000000000090', true),
('fa740000-0000-4000-8000-000000000093', 'OUTBOUND', 'Device failure', '+61400999991', '+61400999990', 'FAILED', null, false),
('fa740000-0000-4000-8000-000000000093', 'INBOUND', 'Inbound failure', '+61400999990', '+61400999991', 'FAILED', 'fa740000-0000-4000-8000-000000000090', false);
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id = 'fa740000-0000-4000-8000-000000000090'), 1::bigint, 'imports, device sends, and inbound messages do not alert staff');
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id)
VALUES ('fa740000-0000-4000-8000-000000000093', 'OUTBOUND', 'Immediate failure', '+61400999991', '+61400999990', 'FAILED', 'fa740000-0000-4000-8000-000000000090');
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id = 'fa740000-0000-4000-8000-000000000090'), 2::bigint, 'immediate failures also notify');
UPDATE public.conversations SET contact_id = null, is_group_chat = true, group_chat_id = 'test-group', group_chat_name = 'Test group' WHERE id = 'fa740000-0000-4000-8000-000000000093';
INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id)
VALUES ('fa740000-0000-4000-8000-000000000095', 'fa740000-0000-4000-8000-000000000093', 'OUTBOUND', 'Group failure', '+61400999991', '+61400999990', 'FAILED', 'fa740000-0000-4000-8000-000000000090');
SELECT is((SELECT action_url FROM public.notifications WHERE dedupe_key = 'message:delivery-failed:fa740000-0000-4000-8000-000000000095'), '/messages?group=fa740000-0000-4000-8000-000000000093', 'group notification opens the group');
SELECT is((SELECT title FROM public.notifications WHERE dedupe_key = 'message:delivery-failed:fa740000-0000-4000-8000-000000000095'), 'Message to Test group failed', 'group notification identifies recipient');
SELECT * FROM finish();
ROLLBACK;
