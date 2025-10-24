-- Seed data for communications feature
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
-- Student contact by phone (if student exists with phone)
INSERT INTO public.contacts (id, display_name, contact_type, phone_e164, student_id)
SELECT gen_random_uuid(), CONCAT(first_name,' ',last_name), 'STUDENT', phone, id
FROM public.students s
WHERE s.phone IS NOT NULL AND s.phone <> ''
ON CONFLICT (phone_e164) DO NOTHING;

-- Staff contact by phone
INSERT INTO public.contacts (id, display_name, contact_type, phone_e164, staff_id)
SELECT gen_random_uuid(), CONCAT(first_name,' ',last_name), 'STAFF', phone_number, id
FROM public.staff st
WHERE st.phone_number IS NOT NULL AND st.phone_number <> ''
ON CONFLICT (phone_e164) DO NOTHING;


