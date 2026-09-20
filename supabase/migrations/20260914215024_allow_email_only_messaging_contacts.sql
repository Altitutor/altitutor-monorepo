-- iMessage Handles may be either phone numbers or Apple ID email addresses.
-- The email-support migration added contacts.email but left the original phone
-- NOT NULL constraint in place, so inbound email Handles could never persist.
ALTER TABLE public.contacts
  ALTER COLUMN phone_e164 DROP NOT NULL;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_has_messaging_handle
  CHECK (
    phone_e164 IS NOT NULL
    OR NULLIF(BTRIM(email), '') IS NOT NULL
  );
