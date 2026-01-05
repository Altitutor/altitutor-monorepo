-- Seed data for communications feature
-- This file runs after other seed files to ensure contacts are created from existing data
-- 
-- 1) Ensure a default owned number exists (replace with your real Twilio number/SID as needed)
DO $$
DECLARE
  existing_id UUID;
BEGIN
  -- Check if phone number already exists
  SELECT id INTO existing_id
  FROM public.owned_numbers
  WHERE phone_e164 = '+61468064000'
  LIMIT 1;
  
  IF existing_id IS NULL THEN
    -- Insert new phone number
    INSERT INTO public.owned_numbers (id, phone_e164, alphanumeric_sender_id, sender_type, label, messaging_service_sid, is_default)
    VALUES (
      gen_random_uuid(),
      '+61468064000',
      NULL,
      'PHONE',
      'Primary AU',
      NULL,
      true
    );
  ELSE
    -- Update existing to be default
    UPDATE public.owned_numbers
    SET is_default = true
    WHERE id = existing_id;
  END IF;
END $$;

-- 2) Ensure ALTITUTOR alphanumeric sender exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.owned_numbers 
    WHERE alphanumeric_sender_id = 'ALTITUTOR'
  ) THEN
    INSERT INTO public.owned_numbers (id, phone_e164, alphanumeric_sender_id, sender_type, label, messaging_service_sid, is_default)
    VALUES (
      gen_random_uuid(),
      NULL,
      'ALTITUTOR',
      'ALPHANUMERIC',
      'ALTITUTOR',
      NULL,
      false
    );
  END IF;
END $$;

-- 3) Create sample contacts for testing (these will link to students/staff as they exist)
-- Note: This complements the contacts created in 05_communications.sql
-- Note: display_name column was removed in migration 20251025000010_phone_sync_and_validation.sql
-- Student contact by phone (if student exists with phone and doesn't already have a contact)
INSERT INTO public.contacts (id, contact_type, phone_e164, student_id)
SELECT gen_random_uuid(), 'STUDENT', phone, id
FROM public.students s
WHERE s.phone IS NOT NULL AND s.phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.student_id = s.id
  )
ON CONFLICT (phone_e164) DO NOTHING;

-- Staff contact by phone (if staff exists with phone and doesn't already have a contact)
INSERT INTO public.contacts (id, contact_type, phone_e164, staff_id)
SELECT gen_random_uuid(), 'STAFF', phone_number, id
FROM public.staff st
WHERE st.phone_number IS NOT NULL AND st.phone_number <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.staff_id = st.id
  )
ON CONFLICT (phone_e164) DO NOTHING;


