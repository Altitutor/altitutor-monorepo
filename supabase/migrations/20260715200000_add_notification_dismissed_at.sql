-- Migration: Add dismissed_at to notifications
-- Description: Separate user-initiated inbox hide from read/resolved state

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

COMMENT ON COLUMN public.notifications.dismissed_at IS
  'When the recipient hid this item from their inbox; independent of read_at and resolved_at.';

DROP INDEX IF EXISTS idx_notifications_student_scope_unread;
CREATE INDEX idx_notifications_student_scope_unread
  ON public.notifications(student_id, app_scope, created_at DESC)
  WHERE student_id IS NOT NULL
    AND read_at IS NULL
    AND dismissed_at IS NULL
    AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_staff_scope_inbox
  ON public.notifications(staff_id, created_at DESC)
  WHERE staff_id IS NOT NULL
    AND dismissed_at IS NULL
    AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_staff_scope_unread
  ON public.notifications(staff_id, created_at DESC)
  WHERE staff_id IS NOT NULL
    AND read_at IS NULL
    AND dismissed_at IS NULL
    AND resolved_at IS NULL;

DROP VIEW IF EXISTS public.vstudent_notifications;
DROP VIEW IF EXISTS public.vucat_notifications;
DROP VIEW IF EXISTS public.vtutor_notifications;

CREATE VIEW public.vstudent_notifications
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.student_id,
  n.activity_event_id,
  n.notification_type,
  n.app_scope,
  n.title,
  n.body,
  n.read_at,
  n.dismissed_at,
  n.action_url,
  n.metadata,
  n.priority,
  n.expires_at,
  n.resolved_at,
  n.created_at,
  n.updated_at
FROM public.notifications n
WHERE n.student_id = (SELECT public.current_student_id())
  AND n.app_scope = 'student_web'
ORDER BY n.created_at DESC;

CREATE VIEW public.vucat_notifications
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.student_id,
  n.notification_type,
  n.title,
  n.body,
  n.read_at,
  n.dismissed_at,
  n.action_url,
  n.metadata,
  n.priority,
  n.expires_at,
  n.resolved_at,
  n.created_at,
  n.updated_at
FROM public.notifications n
WHERE n.student_id = (SELECT public.current_student_id())
  AND n.app_scope = 'ucat_web'
ORDER BY n.created_at DESC;

CREATE VIEW public.vtutor_notifications
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.staff_id,
  n.activity_event_id,
  n.notification_type,
  n.app_scope,
  n.title,
  n.body,
  n.read_at,
  n.dismissed_at,
  n.action_url,
  n.metadata,
  n.priority,
  n.expires_at,
  n.resolved_at,
  n.created_at,
  n.updated_at
FROM public.notifications n
WHERE n.staff_id = (SELECT public.current_tutor_id())
  AND n.app_scope = 'staff_web'
ORDER BY n.created_at DESC;

GRANT SELECT ON public.vstudent_notifications TO authenticated;
GRANT SELECT ON public.vucat_notifications TO authenticated;
GRANT SELECT ON public.vtutor_notifications TO authenticated;
