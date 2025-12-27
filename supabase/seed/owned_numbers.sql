-- Seed data for communications feature
-- This file runs after other seed files to ensure contacts are created from existing data
-- 
-- 1) Ensure a default owned number exists (replace with your real Twilio number/SID as needed)
INSERT INTO public.owned_numbers (id, phone_e164, label, messaging_service_sid, is_default)
VALUES (
  gen_random_uuid(),
  '+61468064000',
  'Primary AU',
  NULL,
  true
)
ON CONFLICT (phone_e164) DO UPDATE SET is_default = EXCLUDED.is_default;

-- 2) Create sample contacts for testing (these will link to students/staff as they exist)
-- Note: This complements the contacts created in 05_communications.sql
-- Student contact by phone (if student exists with phone and doesn't already have a contact)
INSERT INTO public.contacts (id, display_name, contact_type, phone_e164, student_id)
SELECT gen_random_uuid(), CONCAT(first_name,' ',last_name), 'STUDENT', phone, id
FROM public.students s
WHERE s.phone IS NOT NULL AND s.phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.student_id = s.id
  )
ON CONFLICT (phone_e164) DO NOTHING;

-- Staff contact by phone (if staff exists with phone and doesn't already have a contact)
INSERT INTO public.contacts (id, display_name, contact_type, phone_e164, staff_id)
SELECT gen_random_uuid(), CONCAT(first_name,' ',last_name), 'STAFF', phone_number, id
FROM public.staff st
WHERE st.phone_number IS NOT NULL AND st.phone_number <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.contacts c WHERE c.staff_id = st.id
  )
ON CONFLICT (phone_e164) DO NOTHING;


