-- Migration: Create Reconciliation Views
-- Description:
--  - Create vadmin_reconciliation_* views for identifying data inconsistencies
--  - Views use security_invoker = false (consistent with existing vadmin_* pattern)
--  - Views are read-only and self-resolving (items disappear when underlying data is fixed)
-- Purpose: Enable ADMINSTAFF to identify and resolve data inconsistencies across scheduling, communication, and financial domains

-- ================================================
-- VIEW 1: UNINVOICED SESSIONS
-- ================================================
-- Sessions in the past with no invoice_items

CREATE OR REPLACE VIEW public.vadmin_reconciliation_uninvoiced_sessions
WITH (security_invoker = false)
AS
SELECT 
  ss.id AS sessions_students_id,
  ss.student_id,
  ss.session_id,
  ss.planned_absence,
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  s.billing_type,
  s.subject_id,
  sub.name AS subject_name,
  -- Student details
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email,
  st.phone AS student_phone,
  -- Metadata
  ss.created_at,
  ss.updated_at
FROM public.sessions_students ss
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.students st ON st.id = ss.student_id
WHERE 
  ss.planned_absence = false
  AND s.start_at < NOW()  -- Only past sessions
  AND s.billing_type IS NOT NULL  -- Only billable sessions
  AND NOT EXISTS (
    SELECT 1 FROM public.invoice_items ii 
    WHERE ii.sessions_students_id = ss.id
  );

GRANT SELECT ON public.vadmin_reconciliation_uninvoiced_sessions TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_uninvoiced_sessions IS 
  'Admin view: Past sessions without invoice items (need manual invoicing)';

-- ================================================
-- VIEW 2: ORPHANED INVOICE ITEMS
-- ================================================
-- Invoice items with no invoices (invoice_id is NULL or references non-existent invoice)

CREATE OR REPLACE VIEW public.vadmin_reconciliation_orphaned_invoice_items
WITH (security_invoker = false)
AS
SELECT 
  ii.id AS invoice_item_id,
  ii.invoice_id,
  ii.sessions_students_id,
  ii.student_id,
  ii.session_id,
  ii.amount_cents,
  ii.description,
  ii.is_subsidy,
  ii.created_at,
  -- Session details
  s.start_at AS session_start_at,
  s.type AS session_type,
  sub.name AS subject_name,
  -- Student details
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email,
  st.phone AS student_phone
FROM public.invoice_items ii
LEFT JOIN public.invoices inv ON inv.id = ii.invoice_id
LEFT JOIN public.sessions s ON s.id = ii.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.students st ON st.id = ii.student_id
WHERE 
  ii.invoice_id IS NULL 
  OR inv.id IS NULL;  -- References non-existent invoice

GRANT SELECT ON public.vadmin_reconciliation_orphaned_invoice_items TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_orphaned_invoice_items IS 
  'Admin view: Invoice items without invoices (need manual invoice creation)';

-- ================================================
-- VIEW 3: STUDENTS WITHOUT CLASSES
-- ================================================
-- Students with subjects (via enrollments or preferences) but not enrolled in any active classes

CREATE OR REPLACE VIEW public.vadmin_reconciliation_students_without_classes
WITH (security_invoker = false)
AS
SELECT 
  st.id AS student_id,
  st.first_name,
  st.last_name,
  st.email,
  st.phone,
  st.status AS student_status,
  -- Subject information
  (
    SELECT json_agg(DISTINCT jsonb_build_object(
      'id', sub.id,
      'name', sub.name,
      'curriculum', sub.curriculum,
      'year_level', sub.year_level
    ))
    FROM public.students_subjects ss
    JOIN public.subjects sub ON sub.id = ss.subject_id
    WHERE ss.student_id = st.id
  ) AS subjects,
  -- Enrollment status
  (
    SELECT COUNT(*) > 0
    FROM public.classes_students cs
    WHERE cs.student_id = st.id 
      AND cs.unenrolled_at IS NULL
  ) AS has_active_enrollments,
  -- Metadata
  st.created_at,
  st.updated_at
FROM public.students st
WHERE 
  st.status IN ('CURRENT', 'TRIAL')
  AND EXISTS (
    -- Has subjects via students_subjects
    SELECT 1 FROM public.students_subjects ss 
    WHERE ss.student_id = st.id
  )
  AND NOT EXISTS (
    -- Not enrolled in any active classes
    SELECT 1 FROM public.classes_students cs
    JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.student_id = st.id 
      AND cs.unenrolled_at IS NULL
      AND c.status = 'ACTIVE'
  );

GRANT SELECT ON public.vadmin_reconciliation_students_without_classes TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_students_without_classes IS 
  'Admin view: Students with subjects but not enrolled in any active classes';

-- ================================================
-- VIEW 4: UNLOGGED SESSIONS
-- ================================================
-- Sessions in the past with no tutor_logs

CREATE OR REPLACE VIEW public.vadmin_reconciliation_unlogged_sessions
WITH (security_invoker = false)
AS
SELECT 
  s.id AS session_id,
  s.start_at,
  s.end_at,
  s.type AS session_type,
  s.subject_id,
  sub.name AS subject_name,
  s.class_id,
  c.day_of_week,
  c.start_time AS class_start_time,
  c.end_time AS class_end_time,
  -- Assigned tutors
  (
    SELECT json_agg(jsonb_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'email', st.email,
      'type', ss.type
    ))
    FROM public.sessions_staff ss
    JOIN public.staff st ON st.id = ss.staff_id
    WHERE ss.session_id = s.id
  ) AS assigned_tutors,
  -- Student count
  (
    SELECT COUNT(*)
    FROM public.sessions_students ss
    WHERE ss.session_id = s.id
      AND ss.planned_absence = false
  ) AS student_count,
  -- Metadata
  s.created_at,
  s.updated_at
FROM public.sessions s
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.classes c ON c.id = s.class_id
WHERE 
  s.start_at < NOW()  -- Only past sessions
  AND NOT EXISTS (
    SELECT 1 FROM public.tutor_logs tl 
    WHERE tl.session_id = s.id
  );

GRANT SELECT ON public.vadmin_reconciliation_unlogged_sessions TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_unlogged_sessions IS 
  'Admin view: Past sessions without tutor logs (need manual logging)';

-- ================================================
-- VIEW 5: UNASSIGNED CLASSES
-- ================================================
-- Classes with status = 'ACTIVE' and no active classes_staff assignments (unassigned_at IS NULL)

CREATE OR REPLACE VIEW public.vadmin_reconciliation_unassigned_classes
WITH (security_invoker = false)
AS
SELECT 
  c.id AS class_id,
  c.subject_id,
  sub.name AS subject_name,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.status AS class_status,
  c.room,
  c.level,
  -- Student count
  (
    SELECT COUNT(*)
    FROM public.classes_students cs
    WHERE cs.class_id = c.id
      AND cs.unenrolled_at IS NULL
  ) AS student_count,
  -- Metadata
  c.created_at,
  c.updated_at
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE 
  c.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM public.classes_staff cs
    WHERE cs.class_id = c.id
      AND cs.unassigned_at IS NULL  -- Currently assigned
  );

GRANT SELECT ON public.vadmin_reconciliation_unassigned_classes TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_unassigned_classes IS 
  'Admin view: Active classes without staff assignments (need manual assignment)';

-- ================================================
-- VIEW 6: UNREAD MESSAGES
-- ================================================
-- Conversations with status IN ('OPEN', 'SNOOZED') where:
-- Last message is INBOUND AND
-- No conversation_reads for any staff member OR
-- Last conversation_reads.last_read_message_id < last message ID

CREATE OR REPLACE VIEW public.vadmin_reconciliation_unread_messages
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
  -- Unread count (messages after last read)
  (
    SELECT COUNT(*)
    FROM public.messages m
    WHERE m.conversation_id = conv.id
      AND m.direction = 'INBOUND'
      AND (
        -- No read record exists
        NOT EXISTS (
          SELECT 1 FROM public.conversation_reads cr
          WHERE cr.conversation_id = conv.id
        )
        OR
        -- Last read is before this message
        m.created_at > (
          SELECT COALESCE(MAX(cr.last_read_at), '1970-01-01'::timestamptz)
          FROM public.conversation_reads cr
          WHERE cr.conversation_id = conv.id
        )
      )
  ) AS unread_count,
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
  AND (
    -- No conversation_reads for any staff member
    NOT EXISTS (
      SELECT 1 FROM public.conversation_reads cr
      WHERE cr.conversation_id = conv.id
    )
    OR
    -- Last conversation_reads.last_read_message_id < last message ID
    EXISTS (
      SELECT 1 FROM public.conversation_reads cr
      WHERE cr.conversation_id = conv.id
        AND (cr.last_read_message_id IS NULL OR cr.last_read_message_id < conv.last_message_id)
    )
  );

GRANT SELECT ON public.vadmin_reconciliation_unread_messages TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_unread_messages IS 
  'Admin view: Conversations with unread/unreplied inbound messages';
