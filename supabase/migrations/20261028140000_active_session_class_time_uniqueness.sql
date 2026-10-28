-- Inactive class sessions remain for calendar cancellation and history, and the
-- admin lists omit them. They must not block saving an active session onto the
-- same class, start, and end.

DROP INDEX IF EXISTS public.uq_sessions_class_start_end;

CREATE UNIQUE INDEX uq_sessions_class_start_end
  ON public.sessions (class_id, start_at, end_at)
  WHERE class_id IS NOT NULL AND status = 'ACTIVE';

COMMENT ON INDEX public.uq_sessions_class_start_end IS
  'One active session per class, start, and end. Inactive sessions, including calendar tombstones, do not occupy the slot.';
