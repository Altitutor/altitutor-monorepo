BEGIN;
SELECT plan(25);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
INSERT INTO public.students (id, first_name, last_name, email, phone)
VALUES ('ad100000-0000-4000-8000-000000000001', 'Apple', 'Student', '  Apple.Student@Example.test  ', '+61400000801');
INSERT INTO public.parents (id, first_name, last_name, email, phone)
VALUES ('ad100000-0000-4000-8000-000000000002', 'Apple', 'Parent', 'apple.parent@example.test', '+61400000802');
CREATE TEMP TABLE test_contacts AS SELECT student_id, parent_id, id FROM public.contacts
WHERE student_id = 'ad100000-0000-4000-8000-000000000001' OR parent_id = 'ad100000-0000-4000-8000-000000000002';
SELECT is(public.resolve_messaging_email_contact(' APPLE.STUDENT@example.test '),
  (SELECT id FROM test_contacts WHERE student_id IS NOT NULL), 'normalised profile email reuses the student phone contact');
SELECT is((SELECT email FROM public.contacts WHERE student_id = 'ad100000-0000-4000-8000-000000000001'),
  'apple.student@example.test', 'Apple ID is stored in contact email');
SELECT is((SELECT email FROM public.students WHERE id = 'ad100000-0000-4000-8000-000000000001'),
  '  Apple.Student@Example.test  ', 'profile email is preserved');
SELECT is(public.resolve_messaging_email_contact('APPLE.PARENT@example.test'),
  (SELECT id FROM test_contacts WHERE parent_id IS NOT NULL), 'parent email reuses parent phone contact');
SELECT is(public.resolve_messaging_email_contact('apple.student@example.test'),
  (SELECT id FROM test_contacts WHERE student_id IS NOT NULL), 'repeated inbound email uses same contact');

INSERT INTO public.students (id, first_name, last_name, email)
VALUES ('ad100000-0000-4000-8000-000000000003', 'Email', 'Only', 'email.only@example.test');
CREATE TEMP TABLE email_only AS SELECT public.resolve_messaging_email_contact('email.only@example.test') AS id;
SELECT is((SELECT student_id FROM public.contacts WHERE id = (SELECT id FROM email_only)),
  'ad100000-0000-4000-8000-000000000003'::uuid, 'email-only person is automatically linked');
SELECT is((SELECT phone_e164 FROM public.contacts WHERE id = (SELECT id FROM email_only)), NULL::text, 'no phone is fabricated');

INSERT INTO public.students (id, first_name, last_name, email)
VALUES ('ad100000-0000-4000-8000-000000000004', 'Shared', 'Student', 'shared@example.test');
INSERT INTO public.parents (id, first_name, last_name, email)
VALUES ('ad100000-0000-4000-8000-000000000005', 'Shared', 'Parent', ' SHARED@example.test ');
CREATE TEMP TABLE ambiguous AS SELECT public.resolve_messaging_email_contact('shared@example.test') AS id;
SELECT is((SELECT contact_type FROM public.contacts WHERE id = (SELECT id FROM ambiguous)), 'LEAD', 'shared student/parent email remains unlinked');
SELECT is(public.resolve_messaging_email_contact('SHARED@example.test'), (SELECT id FROM ambiguous), 'ambiguous email does not create duplicate leads');
CREATE TEMP TABLE unknown AS SELECT public.resolve_messaging_email_contact('unknown@example.test') AS id;
SELECT is((SELECT contact_type FROM public.contacts WHERE id = (SELECT id FROM unknown)), 'LEAD', 'unknown email remains unlinked');
SELECT throws_ok($$SELECT public.resolve_messaging_email_contact('not an email')$$, 'P0001', 'Invalid Apple ID email', 'invalid handle rejected');

-- Existing phone conversation and unknown Apple ID conversation on the same sender.
INSERT INTO public.students (id, first_name, last_name, email, phone)
VALUES ('ad100000-0000-4000-8000-000000000006', 'Manual', 'Student', 'regular@example.test', '+61400000806');
-- The dialog may have copied the ordinary profile email before any email was used.
UPDATE public.contacts SET email = 'regular@example.test' WHERE student_id = 'ad100000-0000-4000-8000-000000000006';
INSERT INTO public.contacts (id, email, contact_type, is_opted_out)
VALUES ('ad100000-0000-4000-8000-000000000007', 'different.apple@example.test', 'LEAD', true);
INSERT INTO public.owned_numbers (id, phone_e164, provider)
VALUES ('ad100000-0000-4000-8000-000000000008', '+61400000808', 'IMESSAGE');
INSERT INTO public.conversations (id, contact_id, owned_number_id, needs_follow_up)
VALUES ('ad100000-0000-4000-8000-000000000009',
  (SELECT id FROM public.contacts WHERE student_id = 'ad100000-0000-4000-8000-000000000006'), 'ad100000-0000-4000-8000-000000000008', false),
  ('ad100000-0000-4000-8000-000000000010', 'ad100000-0000-4000-8000-000000000007', 'ad100000-0000-4000-8000-000000000008', true);
INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status, created_at)
VALUES ('ad100000-0000-4000-8000-000000000011', 'ad100000-0000-4000-8000-000000000009', 'INBOUND', 'Phone history', '+61400000806', '+61400000808', 'RECEIVED', now() - interval '1 minute'),
  ('ad100000-0000-4000-8000-000000000012', 'ad100000-0000-4000-8000-000000000010', 'INBOUND', 'Apple ID history', 'different.apple@example.test', '+61400000808', 'RECEIVED', now());
UPDATE public.conversations SET needs_follow_up = true WHERE id = 'ad100000-0000-4000-8000-000000000010';
INSERT INTO public.staff (id, first_name, last_name, role, status)
VALUES ('ad100000-0000-4000-8000-000000000013', 'Read', 'Marker', 'ADMINSTAFF', 'ACTIVE');
INSERT INTO public.conversation_reads (conversation_id, staff_id, last_read_message_id, last_read_at)
VALUES ('ad100000-0000-4000-8000-000000000009', 'ad100000-0000-4000-8000-000000000013', 'ad100000-0000-4000-8000-000000000011', now());
CREATE TEMP TABLE canonical AS SELECT public.link_messaging_email_contact('ad100000-0000-4000-8000-000000000007', 'student', 'ad100000-0000-4000-8000-000000000006') AS id;
SELECT is((SELECT id FROM canonical), (SELECT id FROM public.contacts WHERE student_id = 'ad100000-0000-4000-8000-000000000006'), 'manual email linking reuses existing phone contact');
SELECT is((SELECT email FROM public.students WHERE id = 'ad100000-0000-4000-8000-000000000006'), 'regular@example.test', 'manual linking preserves regular profile email');
SELECT is((SELECT count(*) FROM public.messages WHERE conversation_id = 'ad100000-0000-4000-8000-000000000009'), 2::bigint, 'both histories retained in one conversation');
SELECT is((SELECT from_number_e164 FROM public.messages WHERE id = 'ad100000-0000-4000-8000-000000000012'), 'different.apple@example.test', 'original message address preserved');
SELECT is((SELECT last_message_id FROM public.conversations WHERE id = 'ad100000-0000-4000-8000-000000000009'), 'ad100000-0000-4000-8000-000000000012'::uuid, 'combined preview points to latest message');
SELECT ok((SELECT needs_follow_up FROM public.conversations WHERE id = 'ad100000-0000-4000-8000-000000000009'), 'follow-up state preserved');
SELECT is((SELECT count(*) FROM public.conversations WHERE contact_id = (SELECT id FROM canonical) AND status IN ('OPEN', 'SNOOZED')), 1::bigint, 'one active conversation remains');
SELECT is((SELECT count(*) FROM public.conversation_reads WHERE conversation_id = 'ad100000-0000-4000-8000-000000000009'), 0::bigint, 'unread Apple ID thread keeps combined conversation unread');
SELECT ok((SELECT is_opted_out FROM public.contacts WHERE id = (SELECT id FROM canonical)), 'opt-out preserved');
SELECT is(public.resolve_messaging_email_contact('DIFFERENT.APPLE@example.test'), (SELECT id FROM canonical), 'future email messages resolve to canonical phone contact');
SELECT throws_ok($$SELECT public.link_messaging_email_contact((SELECT id FROM canonical), 'parent', 'ad100000-0000-4000-8000-000000000002')$$,
  'P0001', 'Select an email-only contact', 'linked phone contact cannot be reassigned');
SELECT throws_ok($$SELECT public.link_messaging_email_contact((SELECT id FROM unknown), 'student', 'ad100000-0000-4000-8000-000000000006')$$,
  'P0001', 'This person already has a different Apple ID email', 'another Apple ID cannot replace the saved one');
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000010"}', true);
SELECT throws_ok($$SELECT public.resolve_messaging_email_contact('private@example.test')$$, 'P0001', 'not authorized', 'non-admin cannot resolve profiles');
SELECT throws_ok($$SELECT public.link_messaging_email_contact((SELECT id FROM unknown), 'parent', 'ad100000-0000-4000-8000-000000000002')$$, 'P0001', 'not authorized', 'non-admin cannot assign contacts');
SELECT * FROM finish();
ROLLBACK;
