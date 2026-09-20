BEGIN;
SELECT plan(3);

SELECT lives_ok(
  $$
    INSERT INTO public.contacts (
      id,
      contact_type,
      phone_e164,
      email
    ) VALUES (
      '62200000-0000-4000-8000-000000000001',
      'LEAD',
      NULL,
      'apple-id-handle@invalid.test'
    )
  $$,
  'an Apple ID email handle can create an inbound messaging contact'
);

SELECT is(
  (
    SELECT email
    FROM public.contacts
    WHERE id = '62200000-0000-4000-8000-000000000001'
  ),
  'apple-id-handle@invalid.test',
  'the email handle is retained as the contact identity'
);

SELECT throws_ok(
  $$
    INSERT INTO public.contacts (
      id,
      contact_type,
      phone_e164,
      email
    ) VALUES (
      '62200000-0000-4000-8000-000000000002',
      'LEAD',
      NULL,
      NULL
    )
  $$,
  '23514',
  'new row for relation "contacts" violates check constraint "contacts_has_messaging_handle"',
  'a messaging contact still requires at least one handle'
);

SELECT * FROM finish();
ROLLBACK;
