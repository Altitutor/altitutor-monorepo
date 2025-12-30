-- Migration: Billing Pricing Refactor
-- Description:
--   - Convert sessions.type to enum (session_type)
--   - Add computed billing_type column to sessions
--   - Create billing_pricing table (hourly rates per billing_type)
--   - Create billing_pricing_overrides table (subject-specific overrides)
--   - Remove billing fields from subjects table
--   - Update views to remove subjects billing fields

-- ========================
-- 1. CREATE SESSION_TYPE ENUM
-- ========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'session_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.session_type AS ENUM (
      'CLASS',
      'DRAFTING',
      'EXAM_COURSE',
      'SUBSIDY_INTERVIEW',
      'TRIAL_SESSION',
      'STAFF_INTERVIEW'
    );
  END IF;
END $$;

-- ========================
-- 2. DROP VIEWS THAT DEPEND ON SESSIONS.TYPE
-- ========================
-- Drop views that depend on sessions.type before altering the column
DROP VIEW IF EXISTS public.vtutor_sessions CASCADE;
DROP VIEW IF EXISTS public.vtutor_session_detail CASCADE;
DROP VIEW IF EXISTS public.vstudent_sessions CASCADE;
DROP VIEW IF EXISTS public.vstudent_session_base CASCADE;
DROP VIEW IF EXISTS public.vstudent_session_detail CASCADE;
DROP VIEW IF EXISTS public.vtutor_sessions_students CASCADE;
DROP VIEW IF EXISTS public.vadmin_missing_payment_obligations CASCADE;
DROP VIEW IF EXISTS public.vadmin_failed_payment_attempts CASCADE;
DROP VIEW IF EXISTS public.vadmin_stuck_payment_attempts CASCADE;
DROP VIEW IF EXISTS public.vstudent_invoice_items CASCADE;
DROP VIEW IF EXISTS public.vstudent_payment_attempts CASCADE;
DROP VIEW IF EXISTS public.vstudent_subject_resources CASCADE;

-- ========================
-- 3. CONVERT SESSIONS.TYPE TO ENUM
-- ========================
-- Drop old CHECK constraint if it exists
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_type_check;

-- Convert the column type
ALTER TABLE public.sessions
  ALTER COLUMN type TYPE public.session_type USING type::text::public.session_type;

-- ========================
-- 4. ADD COMPUTED BILLING_TYPE COLUMN TO SESSIONS
-- ========================
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS billing_type public.billing_type 
  GENERATED ALWAYS AS (
    CASE 
      WHEN type = 'CLASS' THEN 'CLASS'::billing_type
      WHEN type = 'DRAFTING' THEN 'DRAFTING'::billing_type
      WHEN type = 'EXAM_COURSE' THEN 'EXAM_COURSE'::billing_type
      ELSE NULL  -- Non-billable types
    END
  ) STORED;

-- Add index for billing queries
CREATE INDEX IF NOT EXISTS idx_sessions_billing_type ON public.sessions(billing_type) WHERE billing_type IS NOT NULL;

-- ========================
-- 5. CREATE BILLING_PRICING TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.billing_pricing (
  billing_type public.billing_type PRIMARY KEY,
  hourly_rate_cents INTEGER NOT NULL CHECK (hourly_rate_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default pricing (can be updated via UI)
INSERT INTO public.billing_pricing (billing_type, hourly_rate_cents, currency)
VALUES 
  ('CLASS', 5000, 'AUD'),        -- $50/hour default
  ('EXAM_COURSE', 4000, 'AUD'),  -- $40/hour default
  ('DRAFTING', 5000, 'AUD')      -- $50/hour default
ON CONFLICT (billing_type) DO NOTHING;

-- Add updated_at trigger
CREATE TRIGGER set_updated_at_billing_pricing
BEFORE UPDATE ON public.billing_pricing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS policies
ALTER TABLE public.billing_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to billing_pricing" ON public.billing_pricing;
CREATE POLICY "ADMINSTAFF full access to billing_pricing" ON public.billing_pricing
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ========================
-- 6. CREATE BILLING_PRICING_OVERRIDES TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.billing_pricing_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  billing_type public.billing_type NOT NULL,
  hourly_rate_cents INTEGER NOT NULL CHECK (hourly_rate_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one override per subject+billing_type combination
  CONSTRAINT billing_pricing_overrides_unique_subject_billing_type 
    UNIQUE(subject_id, billing_type),
  
  -- Effective date range validation
  CONSTRAINT billing_pricing_overrides_effective_range_chk CHECK (
    effective_until IS NULL OR effective_until > effective_from
  )
);

CREATE INDEX IF NOT EXISTS idx_billing_pricing_overrides_subject ON public.billing_pricing_overrides(subject_id);
CREATE INDEX IF NOT EXISTS idx_billing_pricing_overrides_billing_type ON public.billing_pricing_overrides(billing_type);
CREATE INDEX IF NOT EXISTS idx_billing_pricing_overrides_effective_from ON public.billing_pricing_overrides(effective_from);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at_billing_pricing_overrides
BEFORE UPDATE ON public.billing_pricing_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS policies
ALTER TABLE public.billing_pricing_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ADMINSTAFF full access to billing_pricing_overrides" ON public.billing_pricing_overrides;
CREATE POLICY "ADMINSTAFF full access to billing_pricing_overrides" ON public.billing_pricing_overrides
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ========================
-- 7. RECREATE VIEWS - REMOVE SUBJECTS BILLING FIELDS AND UPDATE SESSION TYPE
-- ========================

-- Recreate vtutor_sessions view (with session_type enum)
CREATE OR REPLACE VIEW public.vtutor_sessions
WITH (security_invoker = false)
AS
SELECT 
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  -- Class details (if applicable)
  c.day_of_week AS class_day_of_week,
  c.start_time AS class_start_time,
  c.end_time AS class_end_time,
  c.room AS class_room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level
FROM public.sessions s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE s.id IN (
  SELECT session_id 
  FROM public.sessions_staff 
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_sessions TO authenticated;

-- Recreate vtutor_session_detail view
CREATE OR REPLACE VIEW public.vtutor_session_detail
WITH (security_invoker = false)
AS
SELECT 
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  -- Class details
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level,
  -- Students in this session (scoped fields only)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'status', st.status,
      'school', st.school,
      'curriculum', st.curriculum,
      'year_level', st.year_level,
      'availability_monday', st.availability_monday,
      'availability_tuesday', st.availability_tuesday,
      'availability_wednesday', st.availability_wednesday,
      'availability_thursday', st.availability_thursday,
      'availability_friday', st.availability_friday,
      'availability_saturday_am', st.availability_saturday_am,
      'availability_saturday_pm', st.availability_saturday_pm,
      'availability_sunday_am', st.availability_sunday_am,
      'availability_sunday_pm', st.availability_sunday_pm,
      'session_student_id', ss.id,
      'planned_absence', ss.planned_absence,
      'is_rescheduled', ss.is_rescheduled,
      'is_credited', ss.is_credited
    ))
    FROM public.sessions_students ss
    JOIN public.students st ON st.id = ss.student_id
    WHERE ss.session_id = s.id
  ) AS students,
  -- Staff in this session (scoped fields)
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', sst.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', subj.id, 'name', subj.name))
        FROM public.staff_subjects ss3
        JOIN public.subjects subj ON subj.id = ss3.subject_id
        WHERE ss3.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff sst
    JOIN public.staff staff ON staff.id = sst.staff_id
    WHERE sst.session_id = s.id
  ) AS staff
FROM public.sessions s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE s.id IN (
  SELECT session_id 
  FROM public.sessions_staff 
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_session_detail TO authenticated;

-- Recreate vstudent_sessions view
CREATE OR REPLACE VIEW public.vstudent_sessions
WITH (security_invoker = false)
AS
SELECT 
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  -- Student's attendance info
  ss.id AS session_student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_at,
  -- Class details (reusing class detail logic)
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  -- Students in this session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'year_level', st.year_level
    ))
    FROM public.sessions_students ss2
    JOIN public.students st ON st.id = ss2.student_id
    WHERE ss2.session_id = s.id
  ) AS students,
  -- Staff in this session (limited info + subjects they teach)
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', sst.type,
      'subjects', (
        SELECT json_agg(json_build_object(
          'id', subj.id,
          'name', subj.name
        ))
        FROM public.staff_subjects ss3
        JOIN public.subjects subj ON subj.id = ss3.subject_id
        WHERE ss3.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff sst
    JOIN public.staff staff ON staff.id = sst.staff_id
    WHERE sst.session_id = s.id
  ) AS staff
FROM public.sessions s
JOIN public.sessions_students ss ON ss.session_id = s.id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_sessions TO authenticated;

-- Recreate vstudent_session_detail view
CREATE OR REPLACE VIEW public.vstudent_session_detail
WITH (security_invoker = false)
AS
SELECT
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  ss.id AS session_student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_at,
  -- Class details
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  -- Other students in session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'year_level', st.year_level
    ))
    FROM public.sessions_students ss2
    JOIN public.students st ON st.id = ss2.student_id
    WHERE ss2.session_id = s.id
  ) AS students,
  -- Staff in session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', sst.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', subj.id, 'name', subj.name))
        FROM public.staff_subjects ss3
        JOIN public.subjects subj ON subj.id = ss3.subject_id
        WHERE ss3.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff sst
    JOIN public.staff staff ON staff.id = sst.staff_id
    WHERE sst.session_id = s.id
  ) AS staff
FROM public.sessions s
JOIN public.sessions_students ss ON ss.session_id = s.id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_session_detail TO authenticated;

-- Recreate vtutor_sessions_students view
CREATE OR REPLACE VIEW public.vtutor_sessions_students
WITH (security_invoker = false)
AS
SELECT 
  ss.id AS sessions_students_id,
  ss.session_id,
  ss.student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_sessions_students_id,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_by,
  ss.credited_at,
  s.type AS session_type,
  s.start_at,
  s.end_at,
  s.class_id,
  s.subject_id,
  st.first_name AS student_first_name,
  st.last_name AS student_last_name,
  st.email AS student_email
FROM public.sessions_students ss
JOIN public.sessions s ON s.id = ss.session_id
JOIN public.students st ON st.id = ss.student_id
WHERE s.id IN (
  SELECT session_id 
  FROM public.sessions_staff 
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_sessions_students TO authenticated;

-- ========================
-- 8. UPDATE VIEWS - REMOVE SUBJECTS BILLING FIELDS
-- ========================

-- Drop and recreate vstudent_subjects view (removing billing fields)
DROP VIEW IF EXISTS public.vstudent_subjects CASCADE;

CREATE OR REPLACE VIEW public.vstudent_subjects
WITH (security_invoker = false)
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE sub.id IN (
  -- Subjects from students_subjects
  SELECT ss.subject_id
  FROM public.students_subjects ss
  WHERE ss.student_id = public.current_student_id()
  
  UNION
  
  -- Subjects from enrolled classes
  SELECT c.subject_id
  FROM public.classes_students cs
  JOIN public.classes c ON c.id = cs.class_id
  WHERE cs.student_id = public.current_student_id()
  AND c.subject_id IS NOT NULL
  AND cs.unenrolled_at IS NULL
);

GRANT SELECT ON public.vstudent_subjects TO authenticated;

-- Recreate vstudent_subject_resources view (depends on vstudent_subjects)
CREATE OR REPLACE VIEW public.vstudent_subject_resources
WITH (security_invoker = false)
AS
WITH RECURSIVE topic_tree AS (
  -- Base case: top-level topics
  SELECT 
    t.id,
    t.subject_id,
    t.name,
    t.parent_id,
    t.index,
    t.created_at,
    t.updated_at,
    1 AS depth,
    ARRAY[t.id] AS path
  FROM public.topics t
  WHERE t.parent_id IS NULL
  AND t.subject_id IN (SELECT id FROM public.vstudent_subjects vs)
  
  UNION ALL
  
  -- Recursive case: child topics
  SELECT 
    t.id,
    t.subject_id,
    t.name,
    t.parent_id,
    t.index,
    t.created_at,
    t.updated_at,
    tt.depth + 1,
    tt.path || t.id
  FROM public.topics t
  JOIN topic_tree tt ON t.parent_id = tt.id
  WHERE NOT (t.id = ANY(tt.path))
)
SELECT
  tt.id AS topic_id,
  tt.subject_id,
  tt.name AS topic_name,
  tt.parent_id,
  tt.index AS topic_index,
  tt.depth,
  tt.path AS topic_path,
  -- Files for this topic
  (
    SELECT json_agg(json_build_object(
      'id', tf.id,
      'type', tf.type,
      'index', tf.index,
      'is_solutions', tf.is_solutions,
      'is_solutions_of_id', tf.is_solutions_of_id,
      'file_id', f.id,
      'filename', f.filename,
      'mimetype', f.mimetype,
      'size_bytes', f.size_bytes,
      'storage_path', f.storage_path,
      'bucket', f.bucket,
      'created_at', tf.created_at
    ) ORDER BY tf.index)
    FROM public.topics_files tf
    JOIN public.files f ON f.id = tf.file_id
    WHERE tf.topic_id = tt.id
    AND f.deleted_at IS NULL
  ) AS files
FROM topic_tree tt
ORDER BY tt.path;

GRANT SELECT ON public.vstudent_subject_resources TO authenticated;

-- Recreate vstudent_session_base view
CREATE OR REPLACE VIEW public.vstudent_session_base
WITH (security_invoker = false)
AS
SELECT
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  ss.id AS session_student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_at,
  -- Class details
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  -- Other students in session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'year_level', st.year_level
    ))
    FROM public.sessions_students ss2
    JOIN public.students st ON st.id = ss2.student_id
    WHERE ss2.session_id = s.id
  ) AS students,
  -- Staff in session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', sst.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', subj.id, 'name', subj.name))
        FROM public.staff_subjects ss3
        JOIN public.subjects subj ON subj.id = ss3.subject_id
        WHERE ss3.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff sst
    JOIN public.staff staff ON staff.id = sst.staff_id
    WHERE sst.session_id = s.id
  ) AS staff
FROM public.sessions s
JOIN public.sessions_students ss ON ss.session_id = s.id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_session_base TO authenticated;

-- Recreate vadmin_missing_payment_obligations view (only if payment_attempts table exists)
-- Note: expected_amount_cents removed - calculated dynamically in billing runner
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_attempts') THEN
    CREATE OR REPLACE VIEW public.vadmin_missing_payment_obligations
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
      -- Student billing status
      sb.stripe_customer_id,
      CASE 
        WHEN sb.stripe_customer_id IS NULL THEN 'NO_BILLING_ACCOUNT'
        WHEN NOT EXISTS (
          SELECT 1 FROM public.student_payment_methods spm 
          WHERE spm.student_id = ss.student_id AND spm.is_default = true
        ) THEN 'NO_PAYMENT_METHOD'
        ELSE 'UNKNOWN'
      END AS skip_reason,
      -- Student contact info
      st.first_name AS student_first_name,
      st.last_name AS student_last_name,
      st.email AS student_email,
      st.phone AS student_phone
    FROM public.sessions_students ss
    JOIN public.sessions s ON s.id = ss.session_id
    LEFT JOIN public.subjects sub ON sub.id = s.subject_id
    LEFT JOIN public.students st ON st.id = ss.student_id
    LEFT JOIN public.students_billing sb ON sb.student_id = ss.student_id
    WHERE 
      ss.planned_absence = false
      AND s.start_at < NOW()  -- Only past sessions
      AND s.billing_type IS NOT NULL  -- Only billable sessions
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_attempts pa 
        WHERE pa.sessions_students_id = ss.id
      );

    GRANT SELECT ON public.vadmin_missing_payment_obligations TO authenticated;
  END IF;
END $$;

-- Recreate vadmin_failed_payment_attempts view (only if payment_attempts table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_attempts') THEN
    CREATE OR REPLACE VIEW public.vadmin_failed_payment_attempts
    AS
    WITH latest_attempts AS (
      SELECT DISTINCT ON (sessions_students_id)
        pa.*
      FROM public.payment_attempts pa
      ORDER BY pa.sessions_students_id, pa.attempt_number DESC
    )
    SELECT 
      la.id AS payment_attempt_id,
      la.sessions_students_id,
      la.student_id,
      la.session_id,
      la.attempt_number,
      la.amount_cents,
      la.currency,
      la.status,
      la.failure_code,
      la.failure_message,
      la.created_at,
      -- Session details
      s.start_at AS session_start_at,
      s.type AS session_type,
      sub.name AS subject_name,
      -- Student details
      st.first_name AS student_first_name,
      st.last_name AS student_last_name,
      st.email AS student_email,
      st.phone AS student_phone,
      -- Billing details
      sb.stripe_customer_id,
      spm.card_brand,
      spm.card_last4,
      spm.card_exp_month,
      spm.card_exp_year
    FROM latest_attempts la
    JOIN public.sessions s ON s.id = la.session_id
    LEFT JOIN public.subjects sub ON sub.id = s.subject_id
    LEFT JOIN public.students st ON st.id = la.student_id
    LEFT JOIN public.students_billing sb ON sb.student_id = la.student_id
    LEFT JOIN public.student_payment_methods spm ON spm.student_id = la.student_id AND spm.is_default = true
    WHERE 
      la.status = 'failed'
      AND la.attempt_number >= 3;  -- Exceeded retry limit

    GRANT SELECT ON public.vadmin_failed_payment_attempts TO authenticated;
  END IF;
END $$;

-- Recreate vadmin_stuck_payment_attempts view (only if payment_attempts table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_attempts') THEN
    CREATE OR REPLACE VIEW public.vadmin_stuck_payment_attempts
    AS
    WITH latest_attempts AS (
      SELECT DISTINCT ON (sessions_students_id)
        pa.*
      FROM public.payment_attempts pa
      ORDER BY pa.sessions_students_id, pa.attempt_number DESC
    )
    SELECT 
      la.id,
      la.sessions_students_id,
      la.student_id,
      la.session_id,
      la.attempt_number,
      la.amount_cents,
      la.currency,
      la.stripe_payment_intent_id,
      la.stripe_charge_id,
      la.status,
      la.failure_code,
      la.failure_message,
      la.created_at,
      la.updated_at,
      -- Session details
      s.start_at AS session_start_at,
      s.type AS session_type,
      sub.name AS subject_name,
      -- Student details
      st.first_name AS student_first_name,
      st.last_name AS student_last_name,
      st.email AS student_email
    FROM latest_attempts la
    JOIN public.sessions s ON s.id = la.session_id
    LEFT JOIN public.subjects sub ON sub.id = s.subject_id
    LEFT JOIN public.students st ON st.id = la.student_id
    WHERE 
      la.status IN ('pending', 'processing')
      AND la.created_at < NOW() - INTERVAL '24 hours';

    GRANT SELECT ON public.vadmin_stuck_payment_attempts TO authenticated;
  END IF;
END $$;

-- Drop and recreate vtutor_subjects view (removing billing fields)
DROP VIEW IF EXISTS public.vtutor_subjects CASCADE;

CREATE OR REPLACE VIEW public.vtutor_subjects
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE sub.id IN (
  SELECT DISTINCT c.subject_id
  FROM public.classes c
  JOIN public.classes_staff cs ON cs.class_id = c.id
  WHERE cs.staff_id = public.current_staff_id()
  AND c.subject_id IS NOT NULL
);

GRANT SELECT ON public.vtutor_subjects TO authenticated;

-- Recreate vstudent_invoice_items view (only if invoices table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    CREATE OR REPLACE VIEW public.vstudent_invoice_items
    WITH (security_invoker = on)
    AS
    SELECT 
      ii.id,
      ii.invoice_id,
      ii.sessions_students_id,
      ii.amount_cents,
      ii.description,
      ii.is_subsidy,
      ii.session_id,
      ii.student_id,
      ii.created_at,
      -- Join session details
      s.start_at AS session_start_at,
      s.end_at AS session_end_at,
      s.type AS session_type,
      -- Join subject details
      sub.name AS subject_name,
      sub.curriculum AS subject_curriculum
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    JOIN public.sessions s ON s.id = ii.session_id
    LEFT JOIN public.subjects sub ON sub.id = s.subject_id
    WHERE i.student_id = public.current_student_id()
    ORDER BY ii.created_at DESC;

    GRANT SELECT ON public.vstudent_invoice_items TO authenticated;
  END IF;
END $$;

-- Recreate vstudent_payment_attempts view (only if payment_attempts table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_attempts') THEN
    CREATE OR REPLACE VIEW public.vstudent_payment_attempts
    WITH (security_invoker = false)
    AS
    SELECT 
      pa.id,
      pa.sessions_students_id,
      pa.session_id,
      pa.attempt_number,
      pa.amount_cents,
      pa.currency,
      pa.status,
      pa.failure_message,  -- Hide failure_code from students
      pa.receipt_url,
      pa.created_at,
      pa.charged_at,
      pa.refunded_at,
      -- Join session details
      s.start_at AS session_start_at,
      s.end_at AS session_end_at,
      s.type AS session_type,
      -- Join subject details
      sub.name AS subject_name,
      sub.curriculum AS subject_curriculum
    FROM public.payment_attempts pa
    JOIN public.sessions s ON s.id = pa.session_id
    LEFT JOIN public.subjects sub ON sub.id = s.subject_id
    WHERE pa.student_id = public.current_student_id()
    ORDER BY pa.created_at DESC;

    GRANT SELECT ON public.vstudent_payment_attempts TO authenticated;
  END IF;
END $$;

-- ========================
-- 9. REMOVE BILLING FIELDS FROM SUBJECTS TABLE
-- ========================
ALTER TABLE public.subjects
  DROP COLUMN IF EXISTS billing_type,
  DROP COLUMN IF EXISTS session_fee_cents,
  DROP COLUMN IF EXISTS currency;

-- ========================
-- 10. COMMENTS
-- ========================
COMMENT ON TABLE public.billing_pricing IS 'Default hourly pricing rates for each billing type';
COMMENT ON TABLE public.billing_pricing_overrides IS 'Subject-specific hourly pricing overrides (e.g., UCAT at $30/hour)';
COMMENT ON COLUMN public.sessions.billing_type IS 'Computed column: billing type derived from session type (NULL for non-billable sessions)';

