-- Migration: Add student_id to notifications table and create student/tutor views
-- Description:
--  - Add student_id column to notifications table (nullable)
--  - Make staff_id nullable
--  - Add constraint ensuring exactly one recipient (staff_id OR student_id)
--  - Add indexes for student notifications
--  - Create vstudent_notifications view for students to read their own notifications
--  - Create vtutor_notifications view for tutors to read their own notifications
--  - Both views use security_invoker = false (security definer pattern)
-- Related Issue: ALTI-127

-- ========================
-- ALTER notifications TABLE
-- ========================

-- Make staff_id nullable
ALTER TABLE public.notifications 
  ALTER COLUMN staff_id DROP NOT NULL;

-- Add student_id column
ALTER TABLE public.notifications 
  ADD COLUMN student_id UUID REFERENCES public.students(id) ON DELETE CASCADE;

-- Add constraint: exactly one recipient must be set
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_recipient_check CHECK (
    (staff_id IS NOT NULL AND student_id IS NULL) OR
    (staff_id IS NULL AND student_id IS NOT NULL)
  );

-- ========================
-- CREATE INDEXES FOR STUDENT NOTIFICATIONS
-- ========================

-- Index for unread student notifications
CREATE INDEX IF NOT EXISTS idx_notifications_student_unread 
  ON public.notifications(student_id, read_at) 
  WHERE read_at IS NULL AND student_id IS NOT NULL;

-- Index for student notifications ordered by created_at
CREATE INDEX IF NOT EXISTS idx_notifications_student_created 
  ON public.notifications(student_id, created_at DESC) 
  WHERE student_id IS NOT NULL;

-- ========================
-- CREATE VIEW: vstudent_notifications
-- Students can read their own notifications
-- ========================

CREATE OR REPLACE VIEW public.vstudent_notifications
WITH (security_invoker = false)
AS
SELECT 
  n.id,
  n.student_id,
  n.activity_event_id,
  n.notification_type,
  n.title,
  n.body,
  n.read_at,
  n.action_url,
  n.created_at
FROM public.notifications n
WHERE n.student_id = public.current_student_id()
ORDER BY n.created_at DESC;

GRANT SELECT ON public.vstudent_notifications TO authenticated;

COMMENT ON VIEW public.vstudent_notifications IS 'Student view: Own notifications (read-only)';

-- ========================
-- CREATE VIEW: vtutor_notifications
-- Tutors can read their own notifications
-- ========================

CREATE OR REPLACE VIEW public.vtutor_notifications
WITH (security_invoker = false)
AS
SELECT 
  n.id,
  n.staff_id,
  n.activity_event_id,
  n.notification_type,
  n.title,
  n.body,
  n.read_at,
  n.action_url,
  n.created_at
FROM public.notifications n
WHERE n.staff_id = public.current_tutor_id()
ORDER BY n.created_at DESC;

GRANT SELECT ON public.vtutor_notifications TO authenticated;

COMMENT ON VIEW public.vtutor_notifications IS 'Tutor view: Own notifications (read-only)';

-- ========================
-- COMMENTS
-- ========================

COMMENT ON COLUMN public.notifications.staff_id IS 'Staff member who receives this notification (mutually exclusive with student_id)';
COMMENT ON COLUMN public.notifications.student_id IS 'Student who receives this notification (mutually exclusive with staff_id)';
COMMENT ON CONSTRAINT notifications_recipient_check ON public.notifications IS 'Ensures exactly one recipient: either staff_id or student_id must be set, but not both';
