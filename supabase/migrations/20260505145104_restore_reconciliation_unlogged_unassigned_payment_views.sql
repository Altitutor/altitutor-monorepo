-- Migration: Restore reconciliation views (unlogged, unassigned classes, no payment method)
-- Description:
--  - Recreate vadmin_reconciliation_unlogged_sessions and vadmin_reconciliation_unassigned_classes
--    (removed 20260204 in favor of client-side queries) so the admin app can load each list in one
--    round trip and use exact COUNT queries for tab badges.
--  - Recreate vadmin_reconciliation_students_without_payment_method for ACTIVE students with no
--    student_payment_methods rows (matches admin-web reconciliation semantics).
-- Purpose: Remove N+1 Supabase calls and duplicate full-table fetches on reconciliation load.

-- ================================================
-- VIEW: UNLOGGED SESSIONS
-- ================================================

CREATE OR REPLACE VIEW public.vadmin_reconciliation_unlogged_sessions
WITH (security_invoker = false)
AS
SELECT
  s.id AS session_id,
  s.start_at,
  s.end_at,
  s.type AS session_type,
  TRIM(
    BOTH
    FROM
      COALESCE(
        NULLIF(TRIM(BOTH FROM COALESCE(s.short_name, '')), ''),
        NULLIF(TRIM(BOTH FROM COALESCE(s.long_name, '')), ''),
        NULLIF(TRIM(BOTH FROM COALESCE(sub.name, '')), ''),
        'Session'
      )
  ) AS session_name,
  s.subject_id,
  sub.name AS subject_name,
  s.class_id,
  c.day_of_week,
  c.start_time AS class_start_time,
  c.end_time AS class_end_time,
  (
    SELECT
      COALESCE(
        json_agg(
          json_build_object(
            'id',
            st.id,
            'first_name',
            st.first_name,
            'last_name',
            st.last_name,
            'email',
            st.email,
            'type',
            ss.type
          )
        ),
        '[]'::json
      )
    FROM public.sessions_staff ss
    JOIN public.staff st ON st.id = ss.staff_id
    WHERE
      ss.session_id = s.id
  ) AS assigned_tutors,
  (
    SELECT COUNT(*)::integer
    FROM
      public.sessions_students ss2
    WHERE
      ss2.session_id = s.id
      AND ss2.planned_absence = false
  ) AS student_count,
  s.created_at,
  s.updated_at
FROM
  public.sessions s
  LEFT JOIN public.subjects sub ON sub.id = s.subject_id
  LEFT JOIN public.classes c ON c.id = s.class_id
WHERE
  s.start_at < NOW()
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.tutor_logs tl
    WHERE
      tl.session_id = s.id
  );

GRANT SELECT ON public.vadmin_reconciliation_unlogged_sessions TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_unlogged_sessions IS
  'Admin view: Past sessions without tutor logs (single-query source for reconciliation).';

-- ================================================
-- VIEW: UNASSIGNED CLASSES
-- ================================================

CREATE OR REPLACE VIEW public.vadmin_reconciliation_unassigned_classes
WITH (security_invoker = false)
AS
SELECT
  c.id AS class_id,
  TRIM(
    BOTH
    FROM
      COALESCE(
        NULLIF(TRIM(BOTH FROM COALESCE(c.short_name, '')), ''),
        NULLIF(TRIM(BOTH FROM COALESCE(sub.short_name, '')), ''),
        NULLIF(TRIM(BOTH FROM COALESCE(sub.name, '')), ''),
        NULLIF(TRIM(BOTH FROM COALESCE(c.long_name, '')), ''),
        NULLIF(TRIM(BOTH FROM COALESCE(sub.long_name, '')), ''),
        'Class'
      )
  ) AS class_display_name,
  c.subject_id,
  sub.name AS subject_name,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.status AS class_status,
  c.room,
  c.level,
  (
    SELECT COUNT(*)::integer
    FROM
      public.classes_students cs
    WHERE
      cs.class_id = c.id
      AND cs.unenrolled_at IS NULL
  ) AS student_count,
  c.created_at,
  c.updated_at
FROM
  public.classes c
  LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE
  c.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.classes_staff csf
    WHERE
      csf.class_id = c.id
      AND csf.unassigned_at IS NULL
  );

GRANT SELECT ON public.vadmin_reconciliation_unassigned_classes TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_unassigned_classes IS
  'Admin view: Active classes with no current staff assignment (single-query reconciliation).';

-- ================================================
-- VIEW: STUDENTS WITHOUT PAYMENT METHOD
-- ================================================

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
  sb.stripe_customer_id,
  sb.created_at AS billing_created_at,
  st.created_at,
  st.updated_at
FROM
  public.students st
  LEFT JOIN public.students_billing sb ON sb.student_id = st.id
WHERE
  st.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.student_payment_methods spm
    WHERE
      spm.student_id = st.id
  );

GRANT SELECT ON public.vadmin_reconciliation_students_without_payment_method TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_students_without_payment_method IS
  'Admin view: ACTIVE students with no payment methods on file.';
