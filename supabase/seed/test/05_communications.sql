-- Seed data for communications: parents, contacts, conversations, messages
-- Depends on: students, staff

DO $$
DECLARE
  parent1_id UUID := '60000000-0000-0000-0000-000000000001';
  parent2_id UUID := '60000000-0000-0000-0000-000000000002';
  parent3_id UUID := '60000000-0000-0000-0000-000000000003';
  contact1_id UUID := '61000000-0000-0000-0000-000000000001';
  contact2_id UUID := '61000000-0000-0000-0000-000000000002';
  contact3_id UUID := '61000000-0000-0000-0000-000000000003';
  contact4_id UUID := '61000000-0000-0000-0000-000000000004';
  conversation1_id UUID := '62000000-0000-0000-0000-000000000001';
  conversation2_id UUID := '62000000-0000-0000-0000-000000000002';
  default_owned_number_id UUID;
BEGIN
  -- Ensure a default owned number exists
  SELECT id INTO default_owned_number_id
  FROM public.owned_numbers
  WHERE is_default = true
    AND sender_type = 'PHONE'
  LIMIT 1;
  
  IF default_owned_number_id IS NULL THEN
    -- Create a default owned number if none exists
    -- Check if phone number already exists first (can't use ON CONFLICT with partial unique index)
    SELECT id INTO default_owned_number_id
    FROM public.owned_numbers
    WHERE phone_e164 = '+61400000000'
    LIMIT 1;
    
    IF default_owned_number_id IS NULL THEN
      INSERT INTO public.owned_numbers (id, phone_e164, alphanumeric_sender_id, sender_type, label, is_default)
      VALUES (gen_random_uuid(), '+61400000000', NULL, 'PHONE', 'Default Test Number', true)
      RETURNING id INTO default_owned_number_id;
    ELSE
      -- Update existing to be default
      UPDATE public.owned_numbers
      SET is_default = true
      WHERE id = default_owned_number_id;
    END IF;
  END IF;
  -- ========================
  -- PARENTS
  -- ========================
  INSERT INTO public.parents (id, first_name, last_name, email, phone, created_by)
  VALUES
    (parent1_id, 'Robert', 'Williams', 'robert.williams@parent.test', '+61420000001', '00000000-0000-0000-0000-000000000001'),
    (parent2_id, 'Mary', 'Taylor', 'mary.taylor@parent.test', '+61420000002', '00000000-0000-0000-0000-000000000001'),
    (parent3_id, 'James', 'Martinez', 'james.martinez@parent.test', '+61420000003', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;

  -- ========================
  -- PARENTS_STUDENTS
  -- ========================
  INSERT INTO public.parents_students (id, parent_id, student_id)
  VALUES
    (gen_random_uuid(), parent1_id, '10000000-0000-0000-0000-000000000001'), -- Robert -> Alice
    (gen_random_uuid(), parent2_id, '10000000-0000-0000-0000-000000000002'), -- Mary -> Bob
    (gen_random_uuid(), parent3_id, '10000000-0000-0000-0000-000000000003')  -- James -> Charlie
  ON CONFLICT DO NOTHING;

  -- ========================
  -- CONTACTS
  -- ========================
  -- Note: display_name column was removed in migration 20251025000010_phone_sync_and_validation.sql
  -- Student contacts - ensure they exist, get their IDs
  INSERT INTO public.contacts (id, contact_type, phone_e164, student_id)
  VALUES
    (contact1_id, 'STUDENT', '+61410000001', '10000000-0000-0000-0000-000000000001'),
    (contact2_id, 'STUDENT', '+61410000002', '10000000-0000-0000-0000-000000000002'),
    (contact3_id, 'STUDENT', '+61410000003', '10000000-0000-0000-0000-000000000003')
  ON CONFLICT (phone_e164) DO NOTHING;

  -- Get actual contact IDs (in case they were created by owned_numbers.sql with different IDs)
  SELECT id INTO contact1_id FROM public.contacts WHERE phone_e164 = '+61410000001' LIMIT 1;
  SELECT id INTO contact2_id FROM public.contacts WHERE phone_e164 = '+61410000002' LIMIT 1;

  -- Staff contacts
  INSERT INTO public.contacts (id, contact_type, phone_e164, staff_id)
  VALUES
    (contact4_id, 'STAFF', '+61400000010', '00000000-0000-0000-0000-000000000010')
  ON CONFLICT (phone_e164) DO NOTHING;

  -- Parent contacts
  INSERT INTO public.contacts (id, contact_type, phone_e164, parent_id)
  VALUES
    (gen_random_uuid(), 'PARENT', '+61420000001', parent1_id),
    (gen_random_uuid(), 'PARENT', '+61420000002', parent2_id)
  ON CONFLICT (phone_e164) DO NOTHING;

  -- ========================
  -- CONVERSATIONS
  -- ========================
  -- Only create conversations if contacts exist
  IF contact1_id IS NOT NULL AND default_owned_number_id IS NOT NULL THEN
    INSERT INTO public.conversations (id, contact_id, owned_number_id, last_message_id, last_message_at)
    VALUES (conversation1_id, contact1_id, default_owned_number_id, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  IF contact2_id IS NOT NULL AND default_owned_number_id IS NOT NULL THEN
    INSERT INTO public.conversations (id, contact_id, owned_number_id, last_message_id, last_message_at)
    VALUES (conversation2_id, contact2_id, default_owned_number_id, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- ========================
  -- MESSAGES
  -- ========================
  -- Note: Column is message_sid, not twilio_sid. Also need from_number_e164 and to_number_e164
  INSERT INTO public.messages (id, conversation_id, direction, body, from_number_e164, to_number_e164, status, message_sid, created_at)
  VALUES
    -- Conversation 1 messages
    (gen_random_uuid(), conversation1_id, 'INBOUND', 'Hi, I have a question about the homework', '+61410000001', '+61400000000', 'DELIVERED', 'test_twilio_sid_1', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), conversation1_id, 'OUTBOUND', 'Sure, what would you like to know?', '+61400000000', '+61410000001', 'DELIVERED', 'test_twilio_sid_2', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
    (gen_random_uuid(), conversation1_id, 'INBOUND', 'Thanks for your help!', '+61410000001', '+61400000000', 'DELIVERED', 'test_twilio_sid_3', NOW() - INTERVAL '1 day'),
    
    -- Conversation 2 messages
    (gen_random_uuid(), conversation2_id, 'OUTBOUND', 'Reminder: Class starts at 4pm today', '+61400000000', '+61410000002', 'DELIVERED', 'test_twilio_sid_4', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), conversation2_id, 'INBOUND', 'Got it, thanks!', '+61410000002', '+61400000000', 'DELIVERED', 'test_twilio_sid_5', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes')
  ON CONFLICT DO NOTHING;

  -- Update conversations with last message info
  UPDATE public.conversations c
  SET 
    last_message_id = (
      SELECT id FROM public.messages m 
      WHERE m.conversation_id = c.id 
      ORDER BY m.created_at DESC 
      LIMIT 1
    ),
    last_message_at = (
      SELECT created_at FROM public.messages m 
      WHERE m.conversation_id = c.id 
      ORDER BY m.created_at DESC 
      LIMIT 1
    )
  WHERE c.id IN (conversation1_id, conversation2_id);

  -- ========================
  -- MESSAGE TEMPLATES
  -- ========================
  INSERT INTO public.message_templates (id, name, content, created_by, is_active)
  VALUES
    (gen_random_uuid(), 'Welcome Message', 'Welcome to Altitutor! We''re excited to have you join our classes.', '00000000-0000-0000-0000-000000000001', true),
    (gen_random_uuid(), 'Class Reminder', 'Reminder: Your class starts in 1 hour. See you soon!', '00000000-0000-0000-0000-000000000001', true),
    (gen_random_uuid(), 'Absence Follow-up', 'We noticed you were absent from class. Please let us know if you need to reschedule.', '00000000-0000-0000-0000-000000000001', true),
    (gen_random_uuid(), 'Payment Reminder', 'Friendly reminder: Your payment is due soon. Please update your payment method if needed.', '00000000-0000-0000-0000-000000000001', true)
  ON CONFLICT DO NOTHING;

END $$;

