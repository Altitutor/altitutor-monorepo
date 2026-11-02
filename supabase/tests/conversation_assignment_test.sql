BEGIN;
SELECT plan(22);

INSERT INTO public.staff (id, first_name, last_name, role, status)
VALUES
  ('fa151000-0000-4000-8000-000000000001', 'Ada', 'Admin', 'ADMINSTAFF', 'ACTIVE'),
  ('fa151000-0000-4000-8000-000000000002', 'Bea', 'Admin', 'ADMINSTAFF', 'ACTIVE'),
  ('fa151000-0000-4000-8000-000000000003', 'Tim', 'Tutor', 'TUTOR', 'ACTIVE'),
  ('fa151000-0000-4000-8000-000000000004', 'Ina', 'Inactive', 'ADMINSTAFF', 'INACTIVE');
INSERT INTO public.contacts (id, phone_e164, contact_type)
VALUES ('fa151000-0000-4000-8000-000000000010', '+61415100010', 'OTHER');
INSERT INTO public.owned_numbers (id, phone_e164, provider)
VALUES
  ('fa151000-0000-4000-8000-000000000011', '+61415100011', 'TWILIO'),
  ('fa151000-0000-4000-8000-000000000012', '+61415100012', 'TWILIO');
INSERT INTO public.conversations (id, contact_id, owned_number_id)
VALUES ('fa151000-0000-4000-8000-000000000020', 'fa151000-0000-4000-8000-000000000010', 'fa151000-0000-4000-8000-000000000011');
INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status)
VALUES (
  'fa151000-0000-4000-8000-000000000030',
  'fa151000-0000-4000-8000-000000000020',
  'INBOUND', 'Hello', '+61415100010', '+61415100011', 'RECEIVED'
);

SELECT throws_ok(
  $$UPDATE public.conversations SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000003' WHERE id = 'fa151000-0000-4000-8000-000000000020'$$,
  'P0001', 'conversation assignee must be an active adminstaff',
  'tutors cannot be assigned a conversation'
);
SELECT throws_ok(
  $$UPDATE public.conversations SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000004' WHERE id = 'fa151000-0000-4000-8000-000000000020'$$,
  'P0001', 'conversation assignee must be an active adminstaff',
  'inactive admin staff cannot be assigned a conversation'
);

INSERT INTO public.conversation_reads (conversation_id, staff_id, last_read_message_id)
VALUES (
  'fa151000-0000-4000-8000-000000000020',
  'fa151000-0000-4000-8000-000000000001',
  'fa151000-0000-4000-8000-000000000030'
);
SELECT throws_ok(
  $$UPDATE public.conversations SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000001' WHERE id = 'fa151000-0000-4000-8000-000000000020'$$,
  'P0001', 'only an unread conversation can be assigned',
  'a read conversation cannot be assigned'
);
DELETE FROM public.conversation_reads WHERE conversation_id = 'fa151000-0000-4000-8000-000000000020';

UPDATE public.conversations
SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000001'
WHERE id = 'fa151000-0000-4000-8000-000000000020';
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE staff_id = 'fa151000-0000-4000-8000-000000000001'
      AND notification_type = 'CONVERSATION_ASSIGNED'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000020'),
  1::bigint,
  'assigning an unread conversation notifies that admin'
);
SELECT is(
  (SELECT action_url FROM public.notifications
    WHERE notification_type = 'CONVERSATION_ASSIGNED'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000020'),
  '/messages?contact=fa151000-0000-4000-8000-000000000010',
  'assignment notification opens the contact'
);
SELECT is(
  (SELECT app_scope FROM public.notifications
    WHERE notification_type = 'CONVERSATION_ASSIGNED'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000020'),
  'staff_web',
  'assignment notification belongs to the staff inbox'
);
SELECT is(
  (SELECT title FROM public.notifications
    WHERE notification_type = 'CONVERSATION_ASSIGNED'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000020'),
  'Assigned: +61415100010',
  'assignment notification names the contact'
);

UPDATE public.conversations
SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000001'
WHERE id = 'fa151000-0000-4000-8000-000000000020';
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE notification_type = 'CONVERSATION_ASSIGNED'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000020'),
  1::bigint,
  'setting the same assignee does not notify again'
);

UPDATE public.conversations
SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000002'
WHERE id = 'fa151000-0000-4000-8000-000000000020';
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE staff_id = 'fa151000-0000-4000-8000-000000000002'
      AND notification_type = 'CONVERSATION_ASSIGNED'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000020'),
  1::bigint,
  'reassignment notifies the new admin'
);

SELECT is(
  (SELECT assigned_staff_id FROM public.conversations WHERE id = 'fa151000-0000-4000-8000-000000000020'),
  'fa151000-0000-4000-8000-000000000002'::uuid,
  'reassignment replaces the assignee'
);

INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, is_reaction)
VALUES (
  'fa151000-0000-4000-8000-000000000020',
  'INBOUND', 'Loved “Hello”', '+61415100010', '+61415100011', 'RECEIVED', true
);
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, is_historical_import)
VALUES (
  'fa151000-0000-4000-8000-000000000020',
  'INBOUND', 'Old history', '+61415100010', '+61415100011', 'RECEIVED', true
);
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id)
VALUES (
  'fa151000-0000-4000-8000-000000000020',
  'OUTBOUND', 'Draft reply', '+61415100011', '+61415100010', 'QUEUED',
  'fa151000-0000-4000-8000-000000000001'
);
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE notification_type = 'CONVERSATION_MESSAGE'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000020'),
  0::bigint,
  'reactions, history, and outbound messages do not notify the assignee'
);

INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status)
VALUES (
  'fa151000-0000-4000-8000-000000000031',
  'fa151000-0000-4000-8000-000000000020',
  'INBOUND', 'Are you there?', '+61415100010', '+61415100011', 'RECEIVED'
);
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE staff_id = 'fa151000-0000-4000-8000-000000000002'
      AND notification_type = 'CONVERSATION_MESSAGE'
      AND metadata->>'message_id' = 'fa151000-0000-4000-8000-000000000031'),
  1::bigint,
  'a live inbound message notifies the assignee'
);
SELECT is(
  (SELECT title FROM public.notifications WHERE dedupe_key = 'conversation:assigned-message:fa151000-0000-4000-8000-000000000031'),
  'New message from +61415100010',
  'message notification names the contact'
);
SELECT is(
  (SELECT body FROM public.notifications WHERE dedupe_key = 'conversation:assigned-message:fa151000-0000-4000-8000-000000000031'),
  'Are you there?',
  'message notification includes the message'
);
SELECT is(
  (SELECT action_url FROM public.notifications WHERE dedupe_key = 'conversation:assigned-message:fa151000-0000-4000-8000-000000000031'),
  '/messages?contact=fa151000-0000-4000-8000-000000000010',
  'message notification opens the contact'
);

INSERT INTO public.conversation_reads (conversation_id, staff_id, last_read_message_id)
VALUES (
  'fa151000-0000-4000-8000-000000000020',
  'fa151000-0000-4000-8000-000000000001',
  'fa151000-0000-4000-8000-000000000031'
);
SELECT is(
  (SELECT assigned_staff_id FROM public.conversations WHERE id = 'fa151000-0000-4000-8000-000000000020'),
  NULL,
  'reading the conversation clears the assignment'
);
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status)
VALUES (
  'fa151000-0000-4000-8000-000000000020',
  'INBOUND', 'After it was read', '+61415100010', '+61415100011', 'RECEIVED'
);
SELECT is(
  (SELECT count(*) FROM public.notifications
    WHERE notification_type = 'CONVERSATION_MESSAGE'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000020'),
  1::bigint,
  'messages after the assignment clears do not notify'
);

INSERT INTO public.conversations (id, owned_number_id, is_group_chat, group_chat_id, group_chat_name)
VALUES (
  'fa151000-0000-4000-8000-000000000021',
  'fa151000-0000-4000-8000-000000000011',
  true, 'group-151', 'Study group'
);
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status)
VALUES (
  'fa151000-0000-4000-8000-000000000021',
  'INBOUND', 'Group hello', '+61415100010', '+61415100011', 'RECEIVED'
);
UPDATE public.conversations
SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000001'
WHERE id = 'fa151000-0000-4000-8000-000000000021';
SELECT is(
  (SELECT action_url FROM public.notifications
    WHERE notification_type = 'CONVERSATION_ASSIGNED'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000021'),
  '/messages?group=fa151000-0000-4000-8000-000000000021',
  'group assignment opens the group'
);
SELECT is(
  (SELECT title FROM public.notifications
    WHERE notification_type = 'CONVERSATION_ASSIGNED'
      AND metadata->>'conversation_id' = 'fa151000-0000-4000-8000-000000000021'),
  'Assigned: Study group',
  'group assignment names the group'
);

INSERT INTO public.conversations (id, contact_id, owned_number_id)
VALUES (
  'fa151000-0000-4000-8000-000000000022',
  'fa151000-0000-4000-8000-000000000010',
  'fa151000-0000-4000-8000-000000000012'
);
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status, created_at)
VALUES (
  'fa151000-0000-4000-8000-000000000022',
  'INBOUND', 'Question', '+61415100010', '+61415100011', 'RECEIVED', now() - interval '2 minutes'
);
UPDATE public.conversations
SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000001'
WHERE id = 'fa151000-0000-4000-8000-000000000022';
INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status, created_by_staff_id, created_at)
VALUES (
  'fa151000-0000-4000-8000-000000000032',
  'fa151000-0000-4000-8000-000000000022',
  'OUTBOUND', 'Reply', '+61415100011', '+61415100010', 'QUEUED',
  'fa151000-0000-4000-8000-000000000001', now() - interval '1 minute'
);
SELECT is(
  (SELECT assigned_staff_id FROM public.conversations WHERE id = 'fa151000-0000-4000-8000-000000000022'),
  'fa151000-0000-4000-8000-000000000001'::uuid,
  'a queued reply keeps the assignment'
);
SET LOCAL ROLE service_role;
UPDATE public.messages SET status = 'SENT' WHERE id = 'fa151000-0000-4000-8000-000000000032';
RESET ROLE;
SELECT is(
  (SELECT assigned_staff_id FROM public.conversations WHERE id = 'fa151000-0000-4000-8000-000000000022'),
  NULL,
  'a confirmed reply clears the assignment'
);

INSERT INTO public.conversations (id, contact_id, owned_number_id, status)
VALUES (
  'fa151000-0000-4000-8000-000000000023',
  'fa151000-0000-4000-8000-000000000010',
  'fa151000-0000-4000-8000-000000000011',
  'CLOSED'
);
INSERT INTO public.messages (conversation_id, direction, body, from_number_e164, to_number_e164, status)
VALUES (
  'fa151000-0000-4000-8000-000000000023',
  'INBOUND', 'Old thread', '+61415100010', '+61415100011', 'RECEIVED'
);
SELECT throws_ok(
  $$UPDATE public.conversations SET assigned_staff_id = 'fa151000-0000-4000-8000-000000000001' WHERE id = 'fa151000-0000-4000-8000-000000000023'$$,
  'P0001', 'only an unread conversation can be assigned',
  'a closed conversation is not unread and cannot be assigned'
);

SELECT * FROM finish();
ROLLBACK;
