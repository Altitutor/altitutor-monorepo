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
BEGIN
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
  -- Student contacts
  INSERT INTO public.contacts (id, display_name, contact_type, phone_e164, student_id)
  VALUES
    (contact1_id, 'Alice Williams', 'STUDENT', '+61410000001', '10000000-0000-0000-0000-000000000001'),
    (contact2_id, 'Bob Taylor', 'STUDENT', '+61410000002', '10000000-0000-0000-0000-000000000002'),
    (contact3_id, 'Charlie Martinez', 'STUDENT', '+61410000003', '10000000-0000-0000-0000-000000000003')
  ON CONFLICT (phone_e164) DO NOTHING;

  -- Staff contacts
  INSERT INTO public.contacts (id, display_name, contact_type, phone_e164, staff_id)
  VALUES
    (contact4_id, 'John Doe', 'STAFF', '+61400000010', '00000000-0000-0000-0000-000000000010')
  ON CONFLICT (phone_e164) DO NOTHING;

  -- Parent contacts
  INSERT INTO public.contacts (id, display_name, contact_type, phone_e164, parent_id)
  VALUES
    (gen_random_uuid(), 'Robert Williams', 'PARENT', '+61420000001', parent1_id),
    (gen_random_uuid(), 'Mary Taylor', 'PARENT', '+61420000002', parent2_id)
  ON CONFLICT (phone_e164) DO NOTHING;

  -- ========================
  -- CONVERSATIONS
  -- ========================
  INSERT INTO public.conversations (id, contact_id, owned_number_id, last_message_id, last_message_at)
  SELECT
    conversation1_id,
    contact1_id,
    o.id,
    NULL,
    NULL
  FROM public.owned_numbers o
  WHERE o.is_default = true
  LIMIT 1
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.conversations (id, contact_id, owned_number_id, last_message_id, last_message_at)
  SELECT
    conversation2_id,
    contact2_id,
    o.id,
    NULL,
    NULL
  FROM public.owned_numbers o
  WHERE o.is_default = true
  LIMIT 1
  ON CONFLICT (id) DO NOTHING;

  -- ========================
  -- MESSAGES
  -- ========================
  INSERT INTO public.messages (id, conversation_id, direction, body, status, twilio_sid, created_at)
  VALUES
    -- Conversation 1 messages
    (gen_random_uuid(), conversation1_id, 'INBOUND', 'Hi, I have a question about the homework', 'delivered', 'test_twilio_sid_1', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), conversation1_id, 'OUTBOUND', 'Sure, what would you like to know?', 'delivered', 'test_twilio_sid_2', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
    (gen_random_uuid(), conversation1_id, 'INBOUND', 'Thanks for your help!', 'delivered', 'test_twilio_sid_3', NOW() - INTERVAL '1 day'),
    
    -- Conversation 2 messages
    (gen_random_uuid(), conversation2_id, 'OUTBOUND', 'Reminder: Class starts at 4pm today', 'delivered', 'test_twilio_sid_4', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), conversation2_id, 'INBOUND', 'Got it, thanks!', 'delivered', 'test_twilio_sid_5', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes')
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

