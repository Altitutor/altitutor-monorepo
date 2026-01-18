-- Migration: Update Reconciliation Views
-- Description:
--  - Drop vadmin_reconciliation_unread_messages view
--  - Add vadmin_reconciliation_unreplied_messages view (conversations where last message is INBOUND with no OUTBOUND reply)
--  - Add vadmin_reconciliation_failed_delivery_messages view (messages with FAILED or UNDELIVERED status)
--  - Add vadmin_reconciliation_students_without_payment_method view (students with no payment methods)

-- ================================================
-- DROP OLD VIEW: UNREAD MESSAGES
-- ================================================
DROP VIEW IF EXISTS public.vadmin_reconciliation_unread_messages;

-- ================================================
-- VIEW 1: UNREPLIED MESSAGES
-- ================================================
-- Conversations where:
-- - Status is OPEN or SNOOZED
-- - Last message is INBOUND
-- - No OUTBOUND message exists after the last INBOUND message

CREATE OR REPLACE VIEW public.vadmin_reconciliation_unreplied_messages
WITH (security_invoker = false)
AS
SELECT 
  conv.id AS conversation_id,
  conv.contact_id,
  conv.status AS conversation_status,
  conv.last_message_id,
  conv.last_message_at,
  conv.assigned_staff_id,
  -- Contact details
  COALESCE(
    CASE 
      WHEN c.contact_type = 'STUDENT' THEN 
        (SELECT CONCAT(st.first_name, ' ', st.last_name) FROM public.students st WHERE st.id = c.student_id)
      WHEN c.contact_type = 'PARENT' THEN 
        (SELECT CONCAT(p.first_name, ' ', p.last_name) FROM public.parents p WHERE p.id = c.parent_id)
      WHEN c.contact_type = 'STAFF' THEN 
        (SELECT CONCAT(s.first_name, ' ', s.last_name) FROM public.staff s WHERE s.id = c.staff_id)
      ELSE NULL
    END,
    c.phone_e164
  ) AS contact_name,
  c.phone_e164 AS contact_phone,
  c.contact_type,
  c.student_id,
  c.parent_id,
  c.staff_id,
  -- Last message details
  last_msg.id AS last_message_id_detail,
  last_msg.direction AS last_message_direction,
  last_msg.body AS last_message_preview,
  last_msg.created_at AS last_message_created_at,
  -- Time since last message
  EXTRACT(EPOCH FROM (NOW() - conv.last_message_at)) / 3600 AS hours_since_last_message,
  -- Metadata
  conv.created_at,
  conv.updated_at
FROM public.conversations conv
JOIN public.contacts c ON c.id = conv.contact_id
LEFT JOIN public.messages last_msg ON last_msg.id = conv.last_message_id
WHERE 
  conv.status IN ('OPEN', 'SNOOZED')
  AND last_msg.direction = 'INBOUND'
  -- Ensure no OUTBOUND message exists after the last INBOUND message
  AND NOT EXISTS (
    SELECT 1 
    FROM public.messages m
    WHERE m.conversation_id = conv.id
      AND m.direction = 'OUTBOUND'
      AND m.created_at > last_msg.created_at
  );

GRANT SELECT ON public.vadmin_reconciliation_unreplied_messages TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_unreplied_messages IS 
  'Admin view: Conversations where last message is INBOUND with no OUTBOUND reply';

-- ================================================
-- VIEW 2: FAILED DELIVERY MESSAGES
-- ================================================
-- Messages with status FAILED or UNDELIVERED

CREATE OR REPLACE VIEW public.vadmin_reconciliation_failed_delivery_messages
WITH (security_invoker = false)
AS
SELECT 
  m.id AS message_id,
  m.conversation_id,
  m.direction,
  m.body,
  m.status,
  m.status_updated_at,
  m.error_code,
  m.error_message,
  m.message_sid,
  m.from_number_e164,
  m.to_number_e164,
  m.created_at,
  m.updated_at,
  -- Conversation details
  conv.status AS conversation_status,
  conv.assigned_staff_id,
  conv.last_message_at AS conversation_last_message_at,
  -- Contact details
  COALESCE(
    CASE 
      WHEN c.contact_type = 'STUDENT' THEN 
        (SELECT CONCAT(st.first_name, ' ', st.last_name) FROM public.students st WHERE st.id = c.student_id)
      WHEN c.contact_type = 'PARENT' THEN 
        (SELECT CONCAT(p.first_name, ' ', p.last_name) FROM public.parents p WHERE p.id = c.parent_id)
      WHEN c.contact_type = 'STAFF' THEN 
        (SELECT CONCAT(s.first_name, ' ', s.last_name) FROM public.staff s WHERE s.id = c.staff_id)
      ELSE NULL
    END,
    c.phone_e164
  ) AS contact_name,
  c.phone_e164 AS contact_phone,
  c.contact_type,
  c.student_id,
  c.parent_id,
  c.staff_id,
  -- Time since failure
  EXTRACT(EPOCH FROM (NOW() - m.status_updated_at)) / 3600 AS hours_since_failure
FROM public.messages m
JOIN public.conversations conv ON conv.id = m.conversation_id
JOIN public.contacts c ON c.id = conv.contact_id
WHERE 
  m.direction = 'OUTBOUND'
  AND m.status IN ('FAILED', 'UNDELIVERED')
  AND m.status_updated_at IS NOT NULL;

GRANT SELECT ON public.vadmin_reconciliation_failed_delivery_messages TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_failed_delivery_messages IS 
  'Admin view: Outbound messages that failed delivery (FAILED or UNDELIVERED status)';

-- ================================================
-- VIEW 3: STUDENTS WITHOUT PAYMENT METHOD
-- ================================================
-- Students with status CURRENT or TRIAL who have no payment methods

CREATE OR REPLACE VIEW public.vadmin_reconciliation_students_without_payment_method
WITH (security_invoker = false)
AS
SELECT 
  st.id AS student_id,
  st.first_name,
  st.last_name,
  st.email,
  st.phone,
  st.status AS student_status,
  -- Billing info
  sb.stripe_customer_id,
  sb.created_at AS billing_created_at,
  -- Metadata
  st.created_at,
  st.updated_at
FROM public.students st
LEFT JOIN public.students_billing sb ON sb.student_id = st.id
WHERE 
  st.status IN ('CURRENT', 'TRIAL')
  -- No payment methods exist for this student
  AND NOT EXISTS (
    SELECT 1 
    FROM public.student_payment_methods spm
    WHERE spm.student_id = st.id
  );

GRANT SELECT ON public.vadmin_reconciliation_students_without_payment_method TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_students_without_payment_method IS 
  'Admin view: Active students without any payment methods on file';
