-- Model Homework Help as a first-class, non-billable Scheduled offering while
-- reusing the bounded Class recurrence machinery. Historical financial records
-- remain append-only and stable Session ids are retained.

ALTER TABLE public.classes
  ADD COLUMN session_type public.session_type NOT NULL DEFAULT 'CLASS';

ALTER TABLE public.class_schedule_revisions
  ADD COLUMN session_type public.session_type NOT NULL DEFAULT 'CLASS';

ALTER TABLE public.classes
  ALTER COLUMN billing_type DROP NOT NULL;

ALTER TABLE public.class_schedule_revisions
  ALTER COLUMN billing_type DROP NOT NULL;

COMMENT ON COLUMN public.classes.session_type IS
  'Latest Scheduled offering type. Only CLASS and HOMEWORK_HELP are supported by the bounded offering scheduler.';
COMMENT ON COLUMN public.class_schedule_revisions.session_type IS
  'Offering type materialized by this effective-dated schedule revision.';
COMMENT ON COLUMN public.classes.billing_type IS
  'Latest Student billing category. NULL means the Scheduled offering is structurally non-billable.';
COMMENT ON COLUMN public.class_schedule_revisions.billing_type IS
  'Student billing category inherited by Sessions in this revision; NULL for non-billable offerings.';

CREATE OR REPLACE FUNCTION public.set_class_revision_billing_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_configured_session_type TEXT := current_setting('app.class_session_type', TRUE);
  v_configured_billing_type TEXT := current_setting('app.class_billing_type', TRUE);
BEGIN
  IF current_setting('app.class_schedule_apply', TRUE) = 'true'
     AND NULLIF(v_configured_session_type, '') IS NULL THEN
    RAISE EXCEPTION 'Scheduled offering applies must provide an offering type';
  END IF;

  IF NULLIF(v_configured_session_type, '') IS NOT NULL THEN
    IF v_configured_session_type NOT IN ('CLASS', 'HOMEWORK_HELP') THEN
      RAISE EXCEPTION 'Unsupported Scheduled offering type: %', v_configured_session_type;
    END IF;
    NEW.session_type := v_configured_session_type::public.session_type;
  END IF;

  IF NEW.session_type = 'HOMEWORK_HELP'::public.session_type THEN
    NEW.billing_type := NULL;
  ELSIF NULLIF(v_configured_billing_type, '') IS NULL
        AND current_setting('app.class_schedule_apply', TRUE) = 'true' THEN
    RAISE EXCEPTION 'Class schedule applies must provide a billing type';
  ELSIF NULLIF(v_configured_billing_type, '') IS NOT NULL THEN
    NEW.billing_type := v_configured_billing_type::public.billing_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_current_student_active_in_person()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students student
    WHERE student.id = (SELECT public.current_student_id())
      AND student.status = 'ACTIVE'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_student_active_in_person()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_student_active_in_person()
  TO authenticated;

COMMENT ON FUNCTION public.is_current_student_active_in_person() IS
  'Returns whether the current Student has an ACTIVE in-person relationship.';

CREATE OR REPLACE VIEW public.vstudent_classes
WITH (security_invoker = false)
AS
SELECT
  enrollment.id AS enrollment_id,
  enrollment.student_id,
  class.id AS class_id,
  enrollment.enrolled_at,
  enrollment.enrolled_by,
  enrollment.unenrolled_at,
  enrollment.unenrolled_by,
  enrollment.created_at AS enrollment_created_at,
  enrollment.updated_at AS enrollment_updated_at,
  CASE
    WHEN class.session_type = 'HOMEWORK_HELP'::public.session_type THEN 'DROP_IN'
    WHEN enrollment.unenrolled_at IS NULL THEN 'ACTIVE'
    ELSE 'INACTIVE'
  END AS enrollment_status,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level AS class_level,
  class.status AS class_status,
  class.subject_id,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  subject.year_level AS subject_year_level,
  class.short_name,
  class.long_name,
  class.schedule_summary_short,
  class.schedule_summary_long,
  class.schedule_weekdays,
  class.next_session_start_at,
  class.schedule_rows,
  class.session_start_date,
  class.session_end_date,
  class.schedule_timezone,
  class.cohort_label,
  class.schedule_frequency_weeks,
  class.schedule_anchor_date,
  class.session_type
FROM public.classes class
LEFT JOIN public.classes_students enrollment
  ON enrollment.class_id = class.id
  AND enrollment.student_id = (SELECT public.current_student_id())
LEFT JOIN public.subjects subject ON subject.id = class.subject_id
WHERE enrollment.student_id IS NOT NULL
   OR (
     class.session_type = 'HOMEWORK_HELP'::public.session_type
     AND class.status = 'ACTIVE'
     AND class.next_session_start_at IS NOT NULL
     AND (SELECT public.is_current_student_active_in_person())
   );

GRANT SELECT ON public.vstudent_classes TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_class_detail
WITH (security_invoker = false)
AS
SELECT
  class.id AS class_id,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level AS class_level,
  class.status AS class_status,
  class.subject_id,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  (
    SELECT json_agg(json_build_object(
      'id', student.id,
      'first_name', student.first_name,
      'last_name', student.last_name,
      'year_level', student.year_level
    ))
    FROM public.classes_students enrollment
    JOIN public.students student ON student.id = enrollment.student_id
    WHERE enrollment.class_id = class.id
      AND enrollment.unenrolled_at IS NULL
      AND public.is_student_peer_visible(student.id, student.account_class)
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'subjects', (
        SELECT json_agg(json_build_object('id', staff_subject.id, 'name', staff_subject.name))
        FROM public.staff_subjects link
        JOIN public.subjects staff_subject ON staff_subject.id = link.subject_id
        WHERE link.staff_id = staff.id
      )
    ))
    FROM public.classes_staff assignment
    JOIN public.staff staff ON staff.id = assignment.staff_id
    WHERE assignment.class_id = class.id AND assignment.unassigned_at IS NULL
  ) AS staff,
  class.short_name,
  class.long_name,
  class.schedule_summary_short,
  class.schedule_summary_long,
  class.schedule_weekdays,
  class.next_session_start_at,
  class.schedule_rows,
  class.session_start_date,
  class.session_end_date,
  class.schedule_timezone,
  class.cohort_label,
  class.schedule_frequency_weeks,
  class.schedule_anchor_date,
  class.session_type
FROM public.classes class
LEFT JOIN public.subjects subject ON subject.id = class.subject_id
WHERE EXISTS (
  SELECT 1
  FROM public.classes_students enrollment
  WHERE enrollment.class_id = class.id
    AND enrollment.student_id = (SELECT public.current_student_id())
    AND enrollment.unenrolled_at IS NULL
) OR (
  class.session_type = 'HOMEWORK_HELP'::public.session_type
  AND class.status = 'ACTIVE'
  AND class.next_session_start_at IS NOT NULL
  AND (SELECT public.is_current_student_active_in_person())
);

GRANT SELECT ON public.vstudent_class_detail TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_session_detail
WITH (security_invoker = false)
AS
SELECT
  session.id AS session_id,
  session.type AS session_type,
  session.class_id,
  session.subject_id,
  session.start_at,
  session.end_at,
  session.created_at AS session_created_at,
  session.updated_at AS session_updated_at,
  session_student.id AS session_student_id,
  session_student.planned_absence,
  session_student.planned_absence_logged_at,
  session_student.is_rescheduled,
  session_student.rescheduled_at,
  session_student.is_credited,
  session_student.credited_at,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level AS class_level,
  class.status AS class_status,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  subject.year_level AS subject_year_level,
  subject.short_name AS subject_short_name,
  subject.long_name AS subject_long_name,
  (
    SELECT json_agg(json_build_object(
      'id', peer.id,
      'first_name', peer.first_name,
      'last_name', peer.last_name,
      'year_level', peer.year_level
    ))
    FROM public.sessions_students peer_session
    JOIN public.students peer ON peer.id = peer_session.student_id
    WHERE peer_session.session_id = session.id
      AND public.is_student_peer_visible(peer.id, peer.account_class)
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', session_staff.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', staff_subject.id, 'name', staff_subject.name))
        FROM public.staff_subjects link
        JOIN public.subjects staff_subject ON staff_subject.id = link.subject_id
        WHERE link.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff session_staff
    JOIN public.staff staff ON staff.id = session_staff.staff_id
    WHERE session_staff.session_id = session.id
  ) AS staff
FROM public.sessions session
LEFT JOIN public.sessions_students session_student
  ON session_student.session_id = session.id
  AND session_student.student_id = (SELECT public.current_student_id())
LEFT JOIN public.classes class ON class.id = session.class_id
LEFT JOIN public.subjects subject ON subject.id = session.subject_id
WHERE session_student.student_id IS NOT NULL
   OR (
     session.type = 'HOMEWORK_HELP'::public.session_type
     AND session.status = 'ACTIVE'
     AND session.end_at >= NOW()
     AND (SELECT public.is_current_student_active_in_person())
   );

GRANT SELECT ON public.vstudent_session_detail TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_session_base
WITH (security_invoker = false)
AS
SELECT * FROM public.vstudent_session_detail;

GRANT SELECT ON public.vstudent_session_base TO authenticated;

CREATE OR REPLACE VIEW public.vstudent_sessions
WITH (security_invoker = false)
AS
SELECT
  session.id AS session_id,
  session.type AS session_type,
  session.class_id,
  session.subject_id,
  session.start_at,
  session.end_at,
  session.created_at AS session_created_at,
  session.updated_at AS session_updated_at,
  session_student.id AS session_student_id,
  session_student.planned_absence,
  session_student.planned_absence_logged_at,
  session_student.is_rescheduled,
  session_student.rescheduled_at,
  session_student.is_credited,
  session_student.credited_at,
  class.day_of_week,
  class.start_time,
  class.end_time,
  class.room,
  class.level AS class_level,
  class.status AS class_status,
  subject.name AS subject_name,
  subject.curriculum AS subject_curriculum,
  subject.discipline AS subject_discipline,
  subject.level AS subject_level,
  subject.color AS subject_color,
  (
    SELECT json_agg(json_build_object(
      'id', peer.id,
      'first_name', peer.first_name,
      'last_name', peer.last_name,
      'year_level', peer.year_level
    ))
    FROM public.sessions_students peer_session
    JOIN public.students peer ON peer.id = peer_session.student_id
    WHERE peer_session.session_id = session.id
      AND public.is_student_peer_visible(peer.id, peer.account_class)
  ) AS students,
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', session_staff.type,
      'subjects', (
        SELECT json_agg(json_build_object('id', staff_subject.id, 'name', staff_subject.name))
        FROM public.staff_subjects link
        JOIN public.subjects staff_subject ON staff_subject.id = link.subject_id
        WHERE link.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff session_staff
    JOIN public.staff staff ON staff.id = session_staff.staff_id
    WHERE session_staff.session_id = session.id
  ) AS staff,
  (
    SELECT attendance.attended IS FALSE
    FROM public.tutor_logs tutor_log
    INNER JOIN public.tutor_logs_student_attendance attendance
      ON attendance.tutor_log_id = tutor_log.id
      AND attendance.student_id = session_student.student_id
    WHERE tutor_log.session_id = session.id
    LIMIT 1
  ) AS tutor_log_marked_absent
FROM public.sessions session
LEFT JOIN public.sessions_students session_student
  ON session_student.session_id = session.id
  AND session_student.student_id = (SELECT public.current_student_id())
LEFT JOIN public.classes class ON class.id = session.class_id
LEFT JOIN public.subjects subject ON subject.id = session.subject_id
WHERE session_student.student_id IS NOT NULL
   OR (
     session.type = 'HOMEWORK_HELP'::public.session_type
     AND session.status = 'ACTIVE'
     AND session.end_at >= NOW()
     AND (SELECT public.is_current_student_active_in_person())
   );

GRANT SELECT ON public.vstudent_sessions TO authenticated;

COMMENT ON VIEW public.vstudent_sessions IS
  'Student Sessions: assigned history plus upcoming Homework Help for every active in-person Student.';

CREATE OR REPLACE FUNCTION public.compute_staff_tier_metrics(p_staff_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics JSONB := '{}'::jsonb;
  v_row RECORD;
  v_key TEXT;
  v_count NUMERIC;
  v_overrides JSONB;
  v_override_key TEXT;
  v_override_val NUMERIC;
  v_employment_started_at TIMESTAMPTZ;
  v_tenure_days INTEGER;
  v_tenure_weeks INTEGER;
  v_tenure_months INTEGER;
  v_last_promotion_at TIMESTAMPTZ;
  v_since_promotion_days INTEGER;
  v_since_promotion_weeks INTEGER;
  v_since_promotion_months INTEGER;
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';

  IF NOT v_is_service_role
    AND NOT public.is_adminstaff_active()
    AND public.current_staff_id() IS DISTINCT FROM p_staff_id
  THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT employment_started_at, metric_overrides
  INTO v_employment_started_at, v_overrides
  FROM public.staff
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found';
  END IF;

  v_tenure_days := GREATEST(0, CURRENT_DATE - v_employment_started_at::date);
  v_tenure_weeks := v_tenure_days / 7;
  v_tenure_months := (
    EXTRACT(YEAR FROM age(CURRENT_DATE, v_employment_started_at::date))::int * 12
    + EXTRACT(MONTH FROM age(CURRENT_DATE, v_employment_started_at::date))::int
  );
  v_metrics := v_metrics || jsonb_build_object(
    'tenure.days', v_tenure_days,
    'tenure.weeks', v_tenure_weeks,
    'tenure.months', v_tenure_months
  );

  SELECT reviewed_at
  INTO v_last_promotion_at
  FROM public.staff_tier_promotions
  WHERE staff_id = p_staff_id AND outcome = 'approved'
  ORDER BY reviewed_at DESC
  LIMIT 1;
  v_last_promotion_at := COALESCE(v_last_promotion_at, v_employment_started_at);

  v_since_promotion_days := GREATEST(0, CURRENT_DATE - v_last_promotion_at::date);
  v_since_promotion_weeks := v_since_promotion_days / 7;
  v_since_promotion_months := (
    EXTRACT(YEAR FROM age(CURRENT_DATE, v_last_promotion_at::date))::int * 12
    + EXTRACT(MONTH FROM age(CURRENT_DATE, v_last_promotion_at::date))::int
  );
  v_metrics := v_metrics || jsonb_build_object(
    'time_since_promotion.days', v_since_promotion_days,
    'time_since_promotion.weeks', v_since_promotion_weeks,
    'time_since_promotion.months', v_since_promotion_months
  );

  FOR v_row IN
    SELECT
      CASE
        WHEN session.type = 'HOMEWORK_HELP'::public.session_type THEN 'HOMEWORK_HELP'
        WHEN session.type = 'CLASS'::public.session_type AND subject.short_name = 'HOME' THEN 'HOMEWORK_HELP'
        ELSE session.type::text
      END AS session_type,
      CASE
        WHEN session.type = 'HOMEWORK_HELP'::public.session_type THEN 'any'
        WHEN session.type = 'CLASS'::public.session_type AND subject.short_name = 'HOME' THEN 'any'
        ELSE attendance.type::text
      END AS attendance_type,
      COUNT(*)::numeric AS cnt
    FROM public.tutor_logs tutor_log
    INNER JOIN public.sessions session ON session.id = tutor_log.session_id
    INNER JOIN public.tutor_logs_staff_attendance attendance
      ON attendance.tutor_log_id = tutor_log.id
      AND attendance.staff_id = p_staff_id
      AND attendance.attended = TRUE
    LEFT JOIN public.classes class ON class.id = session.class_id
    LEFT JOIN public.subjects subject
      ON subject.id = COALESCE(session.subject_id, class.subject_id)
    GROUP BY 1, 2
  LOOP
    v_key := public.staff_tier_session_metric_key(v_row.session_type, v_row.attendance_type);
    v_metrics := v_metrics || jsonb_build_object(v_key, v_row.cnt);
  END LOOP;

  FOR v_row IN
    SELECT
      CASE WHEN topic_file.is_solutions THEN 'SOLUTIONS' ELSE topic_file.type::text END AS resource_type,
      topic.subject_id,
      COUNT(*)::numeric AS cnt
    FROM public.topics_files topic_file
    INNER JOIN public.topics topic ON topic.id = topic_file.topic_id
    WHERE topic_file.created_by = p_staff_id
    GROUP BY 1, topic.subject_id
  LOOP
    v_key := public.staff_tier_resource_metric_key(v_row.resource_type, v_row.subject_id);
    v_metrics := v_metrics || jsonb_build_object(v_key, v_row.cnt);
  END LOOP;

  IF v_overrides IS NOT NULL AND v_overrides <> '{}'::jsonb THEN
    FOR v_override_key, v_override_val IN
      SELECT entry.key, entry.value::numeric
      FROM jsonb_each_text(v_overrides) AS entry(key, value)
      WHERE entry.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    LOOP
      v_metrics := v_metrics || jsonb_build_object(
        v_override_key,
        COALESCE((v_metrics ->> v_override_key)::numeric, 0) + v_override_val
      );
    END LOOP;
  END IF;

  FOR v_row IN
    SELECT split_part(entry.key, '.', 2) AS session_type,
           SUM(entry.value::numeric) AS cnt
    FROM jsonb_each_text(v_metrics) AS entry(key, value)
    WHERE entry.key ~ '^sessions\.[^.]+\.(MAIN_TUTOR|SECONDARY_TUTOR|TRIAL_TUTOR)$'
    GROUP BY 1
  LOOP
    v_key := public.staff_tier_session_metric_key(v_row.session_type, 'any');
    v_metrics := v_metrics || jsonb_build_object(
      v_key,
      COALESCE((v_metrics ->> v_key)::numeric, 0) + v_row.cnt
    );
  END LOOP;

  SELECT COALESCE(SUM(COALESCE(
    (v_metrics ->> public.staff_tier_session_metric_key(session_type, 'any'))::numeric,
    0
  )), 0)
  INTO v_count
  FROM unnest(ARRAY['CLASS', 'DRAFTING', 'EXAM_COURSE']) AS session_type;
  v_metrics := v_metrics || jsonb_build_object(
    'sessions.teaching.all',
    v_count + COALESCE((v_metrics ->> 'sessions.teaching.all')::numeric, 0)
  );

  SELECT COALESCE(SUM(COALESCE(
    (v_metrics ->> public.staff_tier_session_metric_key(session_type, 'any'))::numeric,
    0
  )), 0)
  INTO v_count
  FROM unnest(ARRAY['ADMIN_SHIFT', 'ADMIN_MEETING']) AS session_type;
  v_metrics := v_metrics || jsonb_build_object(
    'sessions.admin.all',
    v_count + COALESCE((v_metrics ->> 'sessions.admin.all')::numeric, 0)
  );

  RETURN v_metrics;
END;
$$;

COMMENT ON FUNCTION public.compute_staff_tier_metrics(UUID) IS
  'Computes tenure, first-class Homework Help, other Session, and subject-aware resource metrics, then applies additive overrides.';

REVOKE ALL ON FUNCTION public.set_class_revision_billing_type()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_class_revision_billing_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  IF NEW.superseded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT class.schedule_timezone
  INTO v_timezone
  FROM public.classes class
  WHERE class.id = NEW.class_id;

  UPDATE public.classes class
  SET
    session_type = NEW.session_type,
    billing_type = NEW.billing_type,
    billing_type_effective_from = NEW.effective_from
  WHERE class.id = NEW.class_id;

  UPDATE public.sessions session
  SET
    type = NEW.session_type,
    billing_type = NEW.billing_type,
    subject_id = CASE
      WHEN NEW.session_type = 'HOMEWORK_HELP'::public.session_type THEN NULL
      ELSE session.subject_id
    END
  WHERE session.class_id = NEW.class_id
    AND session.start_at >= NEW.effective_from::TIMESTAMP AT TIME ZONE v_timezone
    AND session.start_at < (NEW.effective_to + 1)::TIMESTAMP AT TIME ZONE v_timezone
    AND NOT session.is_schedule_exception;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_class_revision_billing_type()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_session_billing_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_class_billing_type public.billing_type;
  v_class_default_billing_type public.billing_type;
  v_schedule_timezone TEXT;
  v_session_date DATE;
BEGIN
  IF NEW.type = 'HOMEWORK_HELP'::public.session_type THEN
    NEW.billing_type := NULL;
    RETURN NEW;
  END IF;

  IF NEW.class_id IS NOT NULL THEN
    SELECT class.billing_type, class.schedule_timezone
    INTO v_class_default_billing_type, v_schedule_timezone
    FROM public.classes class
    WHERE class.id = NEW.class_id;

    IF NEW.start_at IS NOT NULL THEN
      v_session_date := (
        NEW.start_at AT TIME ZONE COALESCE(v_schedule_timezone, 'Australia/Adelaide')
      )::DATE;

      SELECT revision.billing_type
      INTO v_class_billing_type
      FROM public.class_schedule_revisions revision
      WHERE revision.class_id = NEW.class_id
        AND revision.superseded_at IS NULL
        AND v_session_date BETWEEN revision.effective_from AND revision.effective_to
      ORDER BY revision.effective_from DESC, revision.created_at DESC
      LIMIT 1;
    END IF;

    NEW.billing_type := COALESCE(
      v_class_billing_type,
      v_class_default_billing_type,
      'CLASS'::public.billing_type
    );
  ELSE
    NEW.billing_type := CASE NEW.type
      WHEN 'CLASS'::public.session_type THEN 'CLASS'::public.billing_type
      WHEN 'DRAFTING'::public.session_type THEN 'DRAFTING'::public.billing_type
      WHEN 'EXAM_COURSE'::public.session_type THEN 'EXAM_COURSE'::public.billing_type
      ELSE NULL
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_session_billing_type()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_session_subject_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_class_subject_id UUID;
  v_class_session_type public.session_type;
BEGIN
  IF NEW.class_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT class.subject_id, class.session_type
  INTO v_class_subject_id, v_class_session_type
  FROM public.classes class
  WHERE class.id = NEW.class_id;

  IF NEW.type = 'HOMEWORK_HELP'::public.session_type THEN
    NEW.subject_id := NULL;
  ELSIF NEW.subject_id IS NULL THEN
    NEW.subject_id := v_class_subject_id;
    IF NEW.subject_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create Class Session: Scheduled offering % does not have a Subject', NEW.class_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_pristine_generated_class_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.sessions session
    WHERE session.id = p_session_id
      AND session.type IN (
        'CLASS'::public.session_type,
        'HOMEWORK_HELP'::public.session_type
      )
      AND session.schedule_origin IN ('GENERATED', 'CUSTOM')
      AND NOT session.is_schedule_exception
      AND session.original_start_at = session.start_at
      AND session.original_end_at = session.end_at
      AND NOT EXISTS (
        SELECT 1 FROM public.sessions_students student
        WHERE student.session_id = session.id
          AND (student.planned_absence OR student.is_rescheduled OR student.is_credited OR student.was_trial)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.sessions_staff staff
        WHERE staff.session_id = session.id
          AND (staff.planned_absence OR staff.is_swapped OR staff.was_trial)
      )
      AND NOT EXISTS (SELECT 1 FROM public.tutor_logs log WHERE log.session_id = session.id)
      AND NOT EXISTS (SELECT 1 FROM public.sessions_files file WHERE file.session_id = session.id)
      AND NOT EXISTS (SELECT 1 FROM public.ucat_sessions_resources resource WHERE resource.session_id = session.id)
      AND NOT EXISTS (SELECT 1 FROM public.invoice_items item WHERE item.session_id = session.id)
      AND NOT EXISTS (SELECT 1 FROM public.form_responses response WHERE response.session_id = session.id)
      AND NOT EXISTS (SELECT 1 FROM public.sessions_parents parent WHERE parent.session_id = session.id)
      AND NOT EXISTS (SELECT 1 FROM public.public_link_revocations revocation WHERE revocation.session_id = session.id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_pristine_generated_class_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pristine_generated_class_session(UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_generated_class_session_exception()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.class_schedule_apply', TRUE) IS DISTINCT FROM 'true'
     AND OLD.type IN ('CLASS'::public.session_type, 'HOMEWORK_HELP'::public.session_type)
     AND OLD.schedule_origin IN ('GENERATED', 'CUSTOM')
     AND (
       OLD.type IS DISTINCT FROM NEW.type
       OR OLD.start_at IS DISTINCT FROM NEW.start_at
       OR OLD.end_at IS DISTINCT FROM NEW.end_at
       OR OLD.class_id IS DISTINCT FROM NEW.class_id
       OR OLD.subject_id IS DISTINCT FROM NEW.subject_id
       OR OLD.room IS DISTINCT FROM NEW.room
     ) THEN
    NEW.original_start_at := COALESCE(OLD.original_start_at, OLD.start_at);
    NEW.original_end_at := COALESCE(OLD.original_end_at, OLD.end_at);
    NEW.is_schedule_exception := TRUE;
    NEW.schedule_origin := 'EXCEPTION';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_mark_generated_class_session_exception ON public.sessions;
CREATE TRIGGER trigger_mark_generated_class_session_exception
  BEFORE UPDATE OF type, start_at, end_at, class_id, subject_id, room ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_generated_class_session_exception();

CREATE OR REPLACE FUNCTION public.prevent_homework_help_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.classes class
    WHERE class.id = NEW.class_id
      AND class.session_type = 'HOMEWORK_HELP'::public.session_type
  ) THEN
    RAISE EXCEPTION 'Homework Help uses drop-in Session attendance, not Class enrolment';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_homework_help_enrollment()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trigger_prevent_homework_help_enrollment
  BEFORE INSERT OR UPDATE OF class_id ON public.classes_students
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_homework_help_enrollment();

CREATE OR REPLACE FUNCTION public.prevent_scheduled_offering_type_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.session_type IS DISTINCT FROM NEW.session_type
     AND current_setting('app.class_schedule_apply', TRUE) IS DISTINCT FROM 'true'
     AND EXISTS (SELECT 1 FROM public.sessions session WHERE session.class_id = OLD.id) THEN
    RAISE EXCEPTION 'Scheduled offerings with Sessions require a previewed type-conversion action';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_scheduled_offering_type_overwrite()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trigger_prevent_scheduled_offering_type_overwrite
  BEFORE UPDATE OF session_type ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_scheduled_offering_type_overwrite();

CREATE TEMP TABLE homework_help_migration_targets ON COMMIT DROP AS
SELECT class.id
FROM public.classes class
INNER JOIN public.subjects subject ON subject.id = class.subject_id
WHERE subject.short_name = 'HOME'
  AND LOWER(subject.name) = 'homework help';

CREATE TEMP TABLE homework_help_migration_sessions ON COMMIT DROP AS
SELECT session.id
FROM public.sessions session
WHERE session.class_id IN (SELECT id FROM homework_help_migration_targets)
   OR session.subject_id IN (
     SELECT subject.id
     FROM public.subjects subject
     WHERE subject.short_name = 'HOME'
       AND LOWER(subject.name) = 'homework help'
   );

CREATE TEMP TABLE homework_help_migration_snapshot ON COMMIT DROP AS
SELECT
  (SELECT COUNT(*) FROM homework_help_migration_sessions) AS session_count,
  (SELECT COUNT(*) FROM public.tutor_logs log WHERE log.session_id IN (SELECT id FROM homework_help_migration_sessions)) AS tutor_log_count,
  (SELECT COUNT(*) FROM public.sessions_students student WHERE student.session_id IN (SELECT id FROM homework_help_migration_sessions)) AS student_link_count,
  (
    SELECT COUNT(*)
    FROM public.tutor_logs_student_attendance attendance
    INNER JOIN public.tutor_logs log ON log.id = attendance.tutor_log_id
    WHERE log.session_id IN (SELECT id FROM homework_help_migration_sessions)
  ) AS attendance_count,
  (SELECT COUNT(*) FROM public.invoice_items item WHERE item.session_id IN (SELECT id FROM homework_help_migration_sessions)) AS invoice_item_count,
  (SELECT COALESCE(SUM(item.amount_cents), 0) FROM public.invoice_items item WHERE item.session_id IN (SELECT id FROM homework_help_migration_sessions)) AS invoice_amount_cents;

SELECT set_config('app.class_schedule_apply', 'true', TRUE);

UPDATE public.class_schedule_revisions revision
SET session_type = 'HOMEWORK_HELP'::public.session_type,
    billing_type = NULL
WHERE revision.class_id IN (SELECT id FROM homework_help_migration_targets);

UPDATE public.classes class
SET session_type = 'HOMEWORK_HELP'::public.session_type,
    subject_id = NULL,
    billing_type = NULL
WHERE class.id IN (SELECT id FROM homework_help_migration_targets);

UPDATE public.sessions session
SET type = 'HOMEWORK_HELP'::public.session_type,
    subject_id = NULL,
    billing_type = NULL
WHERE session.id IN (SELECT id FROM homework_help_migration_sessions);

UPDATE public.tutor_logs log
SET session_type = 'HOMEWORK_HELP'::public.session_type
WHERE log.session_id IN (SELECT id FROM homework_help_migration_sessions);

SELECT set_config('app.class_schedule_apply', '', TRUE);

DO $$
DECLARE
  snapshot RECORD;
BEGIN
  SELECT * INTO snapshot FROM homework_help_migration_snapshot;

  IF snapshot.session_count IS DISTINCT FROM (
       SELECT COUNT(*) FROM public.sessions WHERE id IN (SELECT id FROM homework_help_migration_sessions)
     )
     OR snapshot.tutor_log_count IS DISTINCT FROM (
       SELECT COUNT(*) FROM public.tutor_logs WHERE session_id IN (SELECT id FROM homework_help_migration_sessions)
     )
     OR snapshot.student_link_count IS DISTINCT FROM (
       SELECT COUNT(*) FROM public.sessions_students WHERE session_id IN (SELECT id FROM homework_help_migration_sessions)
     )
     OR snapshot.attendance_count IS DISTINCT FROM (
       SELECT COUNT(*)
       FROM public.tutor_logs_student_attendance attendance
       INNER JOIN public.tutor_logs log ON log.id = attendance.tutor_log_id
       WHERE log.session_id IN (SELECT id FROM homework_help_migration_sessions)
     )
     OR snapshot.invoice_item_count IS DISTINCT FROM (
       SELECT COUNT(*) FROM public.invoice_items WHERE session_id IN (SELECT id FROM homework_help_migration_sessions)
     )
     OR snapshot.invoice_amount_cents IS DISTINCT FROM (
       SELECT COALESCE(SUM(amount_cents), 0) FROM public.invoice_items WHERE session_id IN (SELECT id FROM homework_help_migration_sessions)
     ) THEN
    RAISE EXCEPTION 'Homework Help migration changed protected operational or financial history';
  END IF;
END;
$$;

-- Preserve the existing admin search contract while exposing the offering type.
CREATE OR REPLACE FUNCTION public.search_classes_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_student_ids UUID[] DEFAULT NULL,
  p_staff_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_student_search BOOLEAN DEFAULT FALSE,
  p_exclude_staff_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'day_of_week',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_classes JSONB;
BEGIN
  IF NOT (SELECT public.is_adminstaff_active()) THEN
    RETURN jsonb_build_object(
      'classes', '[]'::JSONB,
      'classSubjects', '{}'::JSONB,
      'classStudents', '{}'::JSONB,
      'classStaff', '{}'::JSONB,
      'total', 0
    );
  END IF;

  v_result := public.search_classes_admin_core(
    p_search,
    p_statuses,
    p_subject_ids,
    p_student_ids,
    p_staff_ids,
    p_include_relationships,
    p_exclude_student_search,
    p_exclude_staff_search,
    p_limit,
    p_offset,
    p_order_by,
    p_ascending
  );

  SELECT COALESCE(
    jsonb_agg(
      class_json || jsonb_build_object(
        'session_type', class.session_type,
        'billing_type', class.billing_type,
        'billing_type_effective_from', class.billing_type_effective_from,
        'cohort_label', class.cohort_label,
        'session_start_date', class.session_start_date,
        'session_end_date', class.session_end_date,
        'schedule_timezone', class.schedule_timezone,
        'schedule_summary_short', class.schedule_summary_short,
        'schedule_summary_long', class.schedule_summary_long,
        'schedule_weekdays', class.schedule_weekdays,
        'schedule_rows', class.schedule_rows,
        'schedule_frequency_weeks', class.schedule_frequency_weeks,
        'schedule_anchor_date', class.schedule_anchor_date,
        'next_session_start_at', class.next_session_start_at
      )
      ORDER BY class_row.position
    ),
    '[]'::JSONB
  )
  INTO v_classes
  FROM jsonb_array_elements(COALESCE(v_result->'classes', '[]'::JSONB))
    WITH ORDINALITY AS class_row(class_json, position)
  JOIN public.classes class ON class.id = (class_json->>'id')::UUID;

  RETURN jsonb_set(v_result, '{classes}', v_classes);
END;
$$;

REVOKE ALL ON FUNCTION public.search_classes_admin(
  TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
  INTEGER, INTEGER, TEXT, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_classes_admin(
  TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
  INTEGER, INTEGER, TEXT, BOOLEAN
) TO authenticated;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_scheduled_offering_configuration_check
  CHECK (
    (
      session_type = 'CLASS'::public.session_type
      AND subject_id IS NOT NULL
      AND billing_type IS NOT NULL
    ) OR (
      session_type = 'HOMEWORK_HELP'::public.session_type
      AND subject_id IS NULL
      AND billing_type IS NULL
    )
  );

ALTER TABLE public.class_schedule_revisions
  ADD CONSTRAINT class_schedule_revisions_offering_configuration_check
  CHECK (
    (session_type = 'CLASS'::public.session_type AND billing_type IS NOT NULL)
    OR (session_type = 'HOMEWORK_HELP'::public.session_type AND billing_type IS NULL)
  );

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS check_session_subject_id_when_class_exists,
  ADD CONSTRAINT check_session_subject_id_when_class_exists
    CHECK (
      class_id IS NULL
      OR type = 'HOMEWORK_HELP'::public.session_type
      OR subject_id IS NOT NULL
    ),
  ADD CONSTRAINT sessions_homework_help_configuration_check
    CHECK (
      type <> 'HOMEWORK_HELP'::public.session_type
      OR (subject_id IS NULL AND billing_type IS NULL)
    );

CREATE OR REPLACE FUNCTION public.preview_class_schedule(p_proposal JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_schedule_type TEXT := p_proposal->>'schedule_type';
  v_offering_type_text TEXT := COALESCE(NULLIF(p_proposal->>'session_type', ''), 'CLASS');
  v_offering_type public.session_type;
  v_subject_id UUID := NULLIF(p_proposal->>'subject_id', '')::UUID;
  v_billing_type_text TEXT := NULLIF(p_proposal->>'billing_type', '');
  v_start_date DATE := (p_proposal->>'start_date')::DATE;
  v_end_date DATE := (p_proposal->>'end_date')::DATE;
  v_effective_from DATE := COALESCE((p_proposal->>'effective_from')::DATE, v_start_date);
  v_timezone TEXT := COALESCE(NULLIF(p_proposal->>'timezone', ''), 'Australia/Adelaide');
  v_frequency_weeks SMALLINT := NULLIF(p_proposal->>'frequency_weeks', '')::SMALLINT;
  v_anchor_date DATE := NULLIF(p_proposal->>'anchor_date', '')::DATE;
  v_date DATE;
  v_row JSONB;
  v_other_row JSONB;
  v_row_index BIGINT;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_occurrences JSONB := '[]'::JSONB;
  v_reconciled_occurrences JSONB := '[]'::JSONB;
  v_removals JSONB := '[]'::JSONB;
  v_conflicts JSONB := '[]'::JSONB;
  v_occurrence_count INTEGER := 0;
  v_create_count INTEGER := 0;
  v_preserve_count INTEGER := 0;
  v_cancel_count INTEGER := 0;
  v_protected_count INTEGER := 0;
  v_class_id UUID := NULLIF(p_proposal->>'class_id', '')::UUID;
  v_existing_offering_type public.session_type;
  v_session RECORD;
BEGIN
  IF CURRENT_USER NOT IN ('postgres', 'service_role')
     AND NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE = '42501';
  END IF;

  IF v_offering_type_text NOT IN ('CLASS', 'HOMEWORK_HELP') THEN
    RAISE EXCEPTION 'Unsupported Scheduled offering type: %', v_offering_type_text;
  END IF;
  v_offering_type := v_offering_type_text::public.session_type;

  IF v_offering_type = 'CLASS'::public.session_type THEN
    IF v_subject_id IS NULL THEN
      RAISE EXCEPTION 'A Class Subject is required';
    END IF;
    IF v_billing_type_text NOT IN ('CLASS', 'EXAM_COURSE', 'DRAFTING') THEN
      RAISE EXCEPTION 'A valid Class billing type is required';
    END IF;
  ELSE
    IF v_subject_id IS NOT NULL OR v_billing_type_text IS NOT NULL THEN
      RAISE EXCEPTION 'Homework Help cannot have a Subject or billing type';
    END IF;
    IF v_class_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.classes_students enrollment
      WHERE enrollment.class_id = v_class_id AND enrollment.unenrolled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Homework Help cannot have Class enrolments';
    END IF;
  END IF;

  SELECT class.session_type
  INTO v_existing_offering_type
  FROM public.classes class
  WHERE class.id = v_class_id;

  IF FOUND
     AND v_existing_offering_type IS DISTINCT FROM v_offering_type
     AND EXISTS (SELECT 1 FROM public.sessions session WHERE session.class_id = v_class_id) THEN
    RAISE EXCEPTION 'Scheduled offerings with Sessions require a dedicated type-conversion action';
  END IF;

  IF v_start_date IS NULL OR v_end_date IS NULL OR v_start_date > v_end_date THEN
    RAISE EXCEPTION 'A valid Scheduled offering start and end date are required';
  END IF;

  IF v_effective_from < v_start_date OR v_effective_from > v_end_date THEN
    RAISE EXCEPTION 'The schedule effective date must fall within the Scheduled offering bounds';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone) THEN
    RAISE EXCEPTION 'Unknown Scheduled offering timezone: %', v_timezone;
  END IF;

  IF v_effective_from < (NOW() AT TIME ZONE v_timezone)::DATE THEN
    RAISE EXCEPTION 'The schedule effective date must be today or later';
  END IF;

  IF v_schedule_type = 'RECURRING' THEN
    IF v_frequency_weeks NOT IN (1, 2) OR v_anchor_date IS NULL THEN
      RAISE EXCEPTION 'Recurring schedules require a weekly or fortnightly anchor';
    END IF;

    IF jsonb_array_length(COALESCE(p_proposal->'recurring_rows', '[]'::JSONB)) = 0 THEN
      RAISE EXCEPTION 'A recurring schedule requires at least one row';
    END IF;

    FOR v_row, v_row_index IN
      SELECT value, ordinality
      FROM jsonb_array_elements(p_proposal->'recurring_rows') WITH ORDINALITY
    LOOP
      IF (v_row->>'day_of_week')::INTEGER NOT BETWEEN 0 AND 6
         OR (v_row->>'start_time')::TIME >= (v_row->>'end_time')::TIME THEN
        RAISE EXCEPTION 'Each recurring row requires a valid weekday and time range';
      END IF;

      FOR v_other_row IN
        SELECT value
        FROM jsonb_array_elements(p_proposal->'recurring_rows') WITH ORDINALITY
        WHERE ordinality > v_row_index
      LOOP
        IF (v_row->>'day_of_week')::INTEGER = (v_other_row->>'day_of_week')::INTEGER
           AND (v_row->>'start_time')::TIME < (v_other_row->>'end_time')::TIME
           AND (v_other_row->>'start_time')::TIME < (v_row->>'end_time')::TIME THEN
          RAISE EXCEPTION 'Recurring schedule rows cannot overlap';
        END IF;
      END LOOP;

      v_date := v_effective_from;
      WHILE v_date <= v_end_date LOOP
        IF EXTRACT(DOW FROM v_date)::INTEGER = (v_row->>'day_of_week')::INTEGER
           AND (((v_date - v_anchor_date) / 7) % v_frequency_weeks) = 0 THEN
          v_start_at := (v_date + (v_row->>'start_time')::TIME) AT TIME ZONE v_timezone;
          v_end_at := (v_date + (v_row->>'end_time')::TIME) AT TIME ZONE v_timezone;
          v_occurrences := v_occurrences || jsonb_build_array(jsonb_build_object(
            'source_key', COALESCE(
              v_row->>'id',
              (v_row->>'day_of_week') || ':' || (v_row->>'start_time') || ':' || (v_row->>'end_time')
            ),
            'start_at', v_start_at,
            'end_at', v_end_at,
            'room', NULLIF(v_row->>'room', ''),
            'action', 'CREATE'
          ));
          v_occurrence_count := v_occurrence_count + 1;
        END IF;
        v_date := v_date + 1;
      END LOOP;
    END LOOP;
  ELSIF v_schedule_type = 'CUSTOM' THEN
    IF jsonb_array_length(COALESCE(p_proposal->'custom_sessions', '[]'::JSONB)) = 0 THEN
      RAISE EXCEPTION 'A custom timetable requires at least one Session';
    END IF;

    FOR v_row, v_row_index IN
      SELECT value, ordinality
      FROM jsonb_array_elements(p_proposal->'custom_sessions') WITH ORDINALITY
    LOOP
      v_date := (v_row->>'date')::DATE;
      IF v_date < v_effective_from OR v_date > v_end_date
         OR (v_row->>'start_time')::TIME >= (v_row->>'end_time')::TIME THEN
        RAISE EXCEPTION 'Each custom Session must fall within the Scheduled offering bounds with a valid time range';
      END IF;
      FOR v_other_row IN
        SELECT value
        FROM jsonb_array_elements(p_proposal->'custom_sessions') WITH ORDINALITY
        WHERE ordinality > v_row_index
      LOOP
        IF (v_row->>'date')::DATE = (v_other_row->>'date')::DATE
           AND (v_row->>'start_time')::TIME < (v_other_row->>'end_time')::TIME
           AND (v_other_row->>'start_time')::TIME < (v_row->>'end_time')::TIME THEN
          RAISE EXCEPTION 'Custom timetable Sessions cannot overlap';
        END IF;
      END LOOP;
      v_start_at := (v_date + (v_row->>'start_time')::TIME) AT TIME ZONE v_timezone;
      v_end_at := (v_date + (v_row->>'end_time')::TIME) AT TIME ZONE v_timezone;
      v_occurrences := v_occurrences || jsonb_build_array(jsonb_build_object(
        'source_key', COALESCE(
          v_row->>'id',
          v_date::TEXT || ':' || (v_row->>'start_time') || ':' || (v_row->>'end_time')
        ),
        'start_at', v_start_at,
        'end_at', v_end_at,
        'room', NULLIF(v_row->>'room', ''),
        'action', 'CREATE'
      ));
      v_occurrence_count := v_occurrence_count + 1;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Schedule type must be RECURRING or CUSTOM';
  END IF;

  IF v_occurrence_count > 1000 THEN
    RAISE EXCEPTION 'A Scheduled offering cannot contain more than 1000 Sessions';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_occurrences)
  LOOP
    IF v_class_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.sessions session
      WHERE session.class_id = v_class_id
        AND (
          (session.start_at = (v_row->>'start_at')::TIMESTAMPTZ AND session.end_at = (v_row->>'end_at')::TIMESTAMPTZ)
          OR (session.is_schedule_exception AND session.original_start_at = (v_row->>'start_at')::TIMESTAMPTZ AND session.original_end_at = (v_row->>'end_at')::TIMESTAMPTZ)
        )
    ) THEN
      v_row := jsonb_set(v_row, '{action}', '"PRESERVE"'::JSONB);
      v_preserve_count := v_preserve_count + 1;
    ELSE
      v_create_count := v_create_count + 1;
    END IF;
    v_reconciled_occurrences := v_reconciled_occurrences || jsonb_build_array(v_row);
  END LOOP;

  IF v_class_id IS NOT NULL THEN
    FOR v_session IN
      SELECT session.id, session.start_at, session.end_at, session.is_schedule_exception
      FROM public.sessions session
      WHERE session.class_id = v_class_id
        AND session.type IN ('CLASS'::public.session_type, 'HOMEWORK_HELP'::public.session_type)
        AND session.status = 'ACTIVE'
        AND session.start_at >= v_effective_from::TIMESTAMP AT TIME ZONE v_timezone
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_occurrences) planned
          WHERE (
            (planned->>'start_at')::TIMESTAMPTZ = session.start_at
            AND (planned->>'end_at')::TIMESTAMPTZ = session.end_at
          ) OR (
            session.is_schedule_exception
            AND (planned->>'start_at')::TIMESTAMPTZ = session.original_start_at
            AND (planned->>'end_at')::TIMESTAMPTZ = session.original_end_at
          )
        )
      ORDER BY session.start_at, session.id
    LOOP
      IF public.is_pristine_generated_class_session(v_session.id) THEN
        v_cancel_count := v_cancel_count + 1;
        v_removals := v_removals || jsonb_build_array(jsonb_build_object(
          'session_id', v_session.id,
          'start_at', v_session.start_at,
          'end_at', v_session.end_at,
          'action', 'CANCEL'
        ));
      ELSE
        v_protected_count := v_protected_count + 1;
        v_removals := v_removals || jsonb_build_array(jsonb_build_object(
          'session_id', v_session.id,
          'start_at', v_session.start_at,
          'end_at', v_session.end_at,
          'action', 'PROTECTED'
        ));
      END IF;
    END LOOP;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'type', conflict_type,
    'message', conflict_message
  ) ORDER BY conflict_type, conflict_message), '[]'::JSONB)
  INTO v_conflicts
  FROM (
    SELECT DISTINCT
      'ROOM'::TEXT AS conflict_type,
      'Room ' || (planned->>'room') || ' overlaps another Scheduled offering at ' || (planned->>'start_at') AS conflict_message
    FROM jsonb_array_elements(v_reconciled_occurrences) planned
    JOIN public.sessions other
      ON other.status = 'ACTIVE'
      AND other.type IN ('CLASS'::public.session_type, 'HOMEWORK_HELP'::public.session_type)
      AND other.class_id IS DISTINCT FROM v_class_id
      AND other.start_at < (planned->>'end_at')::TIMESTAMPTZ
      AND other.end_at > (planned->>'start_at')::TIMESTAMPTZ
      AND LOWER(COALESCE(other.room, '')) = LOWER(COALESCE(planned->>'room', ''))
    WHERE NULLIF(planned->>'room', '') IS NOT NULL

    UNION

    SELECT DISTINCT
      'TUTOR'::TEXT,
      'An assigned tutor is already attached to another Session at ' || (planned->>'start_at')
    FROM jsonb_array_elements(v_reconciled_occurrences) planned
    JOIN public.classes_staff own_staff
      ON own_staff.class_id = v_class_id AND own_staff.unassigned_at IS NULL
    JOIN public.sessions_staff other_staff ON other_staff.staff_id = own_staff.staff_id
    JOIN public.sessions other ON other.id = other_staff.session_id
      AND other.status = 'ACTIVE'
      AND other.class_id IS DISTINCT FROM v_class_id
      AND other.start_at < (planned->>'end_at')::TIMESTAMPTZ
      AND other.end_at > (planned->>'start_at')::TIMESTAMPTZ

    UNION

    SELECT DISTINCT
      'STUDENT'::TEXT,
      'An enrolled student is already attached to another Class Session at ' || (planned->>'start_at')
    FROM jsonb_array_elements(v_reconciled_occurrences) planned
    JOIN public.classes_students own_student
      ON own_student.class_id = v_class_id AND own_student.unenrolled_at IS NULL
    JOIN public.sessions_students other_student ON other_student.student_id = own_student.student_id
    JOIN public.sessions other ON other.id = other_student.session_id
      AND other.status = 'ACTIVE'
      AND other.class_id IS DISTINCT FROM v_class_id
      AND other.start_at < (planned->>'end_at')::TIMESTAMPTZ
      AND other.end_at > (planned->>'start_at')::TIMESTAMPTZ
  ) conflict_rows;

  RETURN jsonb_build_object(
    'proposal_hash', encode(extensions.digest(jsonb_build_object(
      'proposal', p_proposal,
      'occurrences', v_reconciled_occurrences,
      'removals', v_removals
    )::TEXT, 'sha256'), 'hex'),
    'counts', jsonb_build_object(
      'create', v_create_count,
      'update', 0,
      'delete', 0,
      'cancel', v_cancel_count,
      'preserve', v_preserve_count,
      'protected', v_protected_count
    ),
    'occurrences', v_reconciled_occurrences,
    'removals', v_removals,
    'conflicts', v_conflicts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_class_schedule(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_class_schedule(JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.preview_class_schedule(JSONB) IS
  'Validates a proposed Scheduled offering and returns its concrete Session reconciliation without writing data.';

CREATE OR REPLACE FUNCTION public.apply_class_schedule_core(
  p_proposal JSONB,
  p_expected_proposal_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_plan JSONB;
  v_class_id UUID := (p_proposal->>'class_id')::UUID;
  v_revision_id UUID := gen_random_uuid();
  v_subject_id UUID := NULLIF(p_proposal->>'subject_id', '')::UUID;
  v_offering_type public.session_type := COALESCE(NULLIF(p_proposal->>'session_type', ''), 'CLASS')::public.session_type;
  v_schedule_type TEXT := p_proposal->>'schedule_type';
  v_start_date DATE := (p_proposal->>'start_date')::DATE;
  v_end_date DATE := (p_proposal->>'end_date')::DATE;
  v_effective_from DATE := COALESCE((p_proposal->>'effective_from')::DATE, v_start_date);
  v_timezone TEXT := COALESCE(NULLIF(p_proposal->>'timezone', ''), 'Australia/Adelaide');
  v_frequency_weeks SMALLINT := NULLIF(p_proposal->>'frequency_weeks', '')::SMALLINT;
  v_anchor_date DATE := NULLIF(p_proposal->>'anchor_date', '')::DATE;
  v_row JSONB;
  v_occurrence JSONB;
  v_session_id UUID;
  v_slot_id UUID;
  v_created_by UUID := (SELECT public.current_staff_id());
  v_previous_assignment_source TEXT := current_setting('app.sessions_staff_assignment_source', TRUE);
  v_previous_schedule_apply TEXT := current_setting('app.class_schedule_apply', TRUE);
  v_primary_day SMALLINT;
  v_primary_start TIME;
  v_primary_end TIME;
  v_primary_room TEXT;
  v_class_status TEXT := COALESCE(NULLIF(p_proposal->>'status', ''), 'ACTIVE');
BEGIN
  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'A client-generated Scheduled offering id is required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_class_id::TEXT, 0));
  v_plan := public.preview_class_schedule(p_proposal);
  IF v_plan->>'proposal_hash' IS DISTINCT FROM p_expected_proposal_hash THEN
    RAISE EXCEPTION 'The Scheduled offering changed after preview; preview it again';
  END IF;

  IF v_offering_type = 'CLASS'::public.session_type AND v_subject_id IS NULL THEN
    RAISE EXCEPTION 'A Class Subject is required';
  END IF;
  IF v_offering_type = 'HOMEWORK_HELP'::public.session_type THEN
    v_subject_id := NULL;
  END IF;

  PERFORM set_config('app.class_schedule_apply', 'true', TRUE);

  IF v_schedule_type = 'RECURRING' THEN
    SELECT
      (row_value->>'day_of_week')::SMALLINT,
      (row_value->>'start_time')::TIME,
      (row_value->>'end_time')::TIME,
      NULLIF(row_value->>'room', '')
    INTO v_primary_day, v_primary_start, v_primary_end, v_primary_room
    FROM jsonb_array_elements(p_proposal->'recurring_rows') WITH ORDINALITY rows(row_value, row_position)
    ORDER BY COALESCE((row_value->>'position')::INTEGER, row_position::INTEGER), row_position
    LIMIT 1;
  ELSE
    SELECT
      EXTRACT(DOW FROM (row_value->>'date')::DATE)::SMALLINT,
      (row_value->>'start_time')::TIME,
      (row_value->>'end_time')::TIME,
      NULLIF(row_value->>'room', '')
    INTO v_primary_day, v_primary_start, v_primary_end, v_primary_room
    FROM jsonb_array_elements(p_proposal->'custom_sessions') WITH ORDINALITY rows(row_value, row_position)
    ORDER BY (row_value->>'date')::DATE, (row_value->>'start_time')::TIME, row_position
    LIMIT 1;
  END IF;

  IF EXISTS (SELECT 1 FROM public.classes class WHERE class.id = v_class_id) THEN
    UPDATE public.classes
    SET
      session_type = v_offering_type,
      subject_id = v_subject_id,
      cohort_label = NULLIF(BTRIM(p_proposal->>'cohort_label'), ''),
      level = NULLIF(BTRIM(p_proposal->>'cohort_label'), ''),
      status = v_class_status,
      session_start_date = v_start_date,
      session_end_date = v_end_date,
      schedule_timezone = v_timezone,
      day_of_week = v_primary_day,
      start_time = v_primary_start,
      end_time = v_primary_end,
      room = v_primary_room
    WHERE id = v_class_id;

    UPDATE public.class_schedule_revisions
    SET superseded_at = NOW()
    WHERE class_id = v_class_id
      AND superseded_at IS NULL
      AND effective_from >= v_effective_from;

    UPDATE public.class_schedule_revisions
    SET effective_to = v_effective_from - 1
    WHERE class_id = v_class_id
      AND superseded_at IS NULL
      AND effective_from < v_effective_from
      AND effective_to >= v_effective_from;
  ELSE
    INSERT INTO public.classes (
      id,
      session_type,
      subject_id,
      cohort_label,
      level,
      status,
      session_start_date,
      session_end_date,
      schedule_timezone,
      day_of_week,
      start_time,
      end_time,
      room,
      created_by
    ) VALUES (
      v_class_id,
      v_offering_type,
      v_subject_id,
      NULLIF(BTRIM(p_proposal->>'cohort_label'), ''),
      NULLIF(BTRIM(p_proposal->>'cohort_label'), ''),
      v_class_status,
      v_start_date,
      v_end_date,
      v_timezone,
      v_primary_day,
      v_primary_start,
      v_primary_end,
      v_primary_room,
      v_created_by
    );
  END IF;

  INSERT INTO public.class_schedule_revisions (
    id,
    class_id,
    session_type,
    schedule_type,
    effective_from,
    effective_to,
    frequency_weeks,
    anchor_date,
    created_by
  ) VALUES (
    v_revision_id,
    v_class_id,
    v_offering_type,
    v_schedule_type,
    v_effective_from,
    v_end_date,
    CASE WHEN v_schedule_type = 'RECURRING' THEN v_frequency_weeks ELSE NULL END,
    CASE WHEN v_schedule_type = 'RECURRING' THEN v_anchor_date ELSE NULL END,
    v_created_by
  );

  IF v_schedule_type = 'RECURRING' THEN
    FOR v_row IN
      SELECT value FROM jsonb_array_elements(p_proposal->'recurring_rows') WITH ORDINALITY
    LOOP
      INSERT INTO public.class_schedule_slots (
        id,
        schedule_revision_id,
        day_of_week,
        start_time,
        end_time,
        room,
        position
      ) VALUES (
        gen_random_uuid(),
        v_revision_id,
        (v_row->>'day_of_week')::SMALLINT,
        (v_row->>'start_time')::TIME,
        (v_row->>'end_time')::TIME,
        NULLIF(v_row->>'room', ''),
        COALESCE((v_row->>'position')::SMALLINT, 0)
      );
    END LOOP;
  END IF;

  UPDATE public.sessions session
  SET
    status = 'INACTIVE',
    calendar_tombstone_until = NOW() + INTERVAL '90 days'
  WHERE session.class_id = v_class_id
    AND session.type IN ('CLASS'::public.session_type, 'HOMEWORK_HELP'::public.session_type)
    AND session.start_at >= v_effective_from::TIMESTAMP AT TIME ZONE v_timezone
    AND public.is_pristine_generated_class_session(session.id)
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_plan->'occurrences') planned
      WHERE (
        (planned->>'start_at')::TIMESTAMPTZ = session.start_at
        AND (planned->>'end_at')::TIMESTAMPTZ = session.end_at
      ) OR (
        session.is_schedule_exception
        AND (planned->>'start_at')::TIMESTAMPTZ = session.original_start_at
        AND (planned->>'end_at')::TIMESTAMPTZ = session.original_end_at
      )
    );

  FOR v_occurrence IN
    SELECT value FROM jsonb_array_elements(v_plan->'occurrences')
  LOOP
    v_slot_id := NULL;
    IF v_schedule_type = 'RECURRING' THEN
      SELECT slot.id
      INTO v_slot_id
      FROM public.class_schedule_slots slot
      WHERE slot.schedule_revision_id = v_revision_id
        AND slot.day_of_week = EXTRACT(
          DOW FROM (v_occurrence->>'start_at')::TIMESTAMPTZ AT TIME ZONE v_timezone
        )::SMALLINT
        AND slot.start_time = (
          (v_occurrence->>'start_at')::TIMESTAMPTZ AT TIME ZONE v_timezone
        )::TIME
        AND slot.end_time = (
          (v_occurrence->>'end_at')::TIMESTAMPTZ AT TIME ZONE v_timezone
        )::TIME
      ORDER BY slot.position, slot.id
      LIMIT 1;
    END IF;

    SELECT session.id INTO v_session_id
    FROM public.sessions session
    WHERE session.class_id = v_class_id
      AND (
        (session.start_at = (v_occurrence->>'start_at')::TIMESTAMPTZ AND session.end_at = (v_occurrence->>'end_at')::TIMESTAMPTZ)
        OR (session.is_schedule_exception AND session.original_start_at = (v_occurrence->>'start_at')::TIMESTAMPTZ AND session.original_end_at = (v_occurrence->>'end_at')::TIMESTAMPTZ)
      )
    LIMIT 1;

    IF v_session_id IS NULL THEN
      INSERT INTO public.sessions (
        id,
        type,
        class_id,
        subject_id,
        start_at,
        end_at,
        status,
        schedule_revision_id,
        schedule_slot_id,
        schedule_origin,
        is_schedule_exception,
        original_start_at,
        original_end_at,
        room
      ) VALUES (
        gen_random_uuid(),
        v_offering_type,
        v_class_id,
        v_subject_id,
        (v_occurrence->>'start_at')::TIMESTAMPTZ,
        (v_occurrence->>'end_at')::TIMESTAMPTZ,
        v_class_status,
        v_revision_id,
        v_slot_id,
        CASE WHEN v_schedule_type = 'RECURRING' THEN 'GENERATED' ELSE 'CUSTOM' END,
        FALSE,
        (v_occurrence->>'start_at')::TIMESTAMPTZ,
        (v_occurrence->>'end_at')::TIMESTAMPTZ,
        NULLIF(v_occurrence->>'room', '')
      ) RETURNING id INTO v_session_id;
    ELSE
      UPDATE public.sessions
      SET
        type = v_offering_type,
        status = v_class_status,
        subject_id = v_subject_id,
        schedule_revision_id = v_revision_id,
        schedule_slot_id = v_slot_id,
        schedule_origin = CASE WHEN v_schedule_type = 'RECURRING' THEN 'GENERATED' ELSE 'CUSTOM' END,
        calendar_tombstone_until = NULL,
        room = NULLIF(v_occurrence->>'room', '')
      WHERE id = v_session_id
        AND NOT is_schedule_exception;
    END IF;

    IF v_offering_type = 'CLASS'::public.session_type THEN
      INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
      SELECT gen_random_uuid(), v_session_id, enrollment.student_id, v_created_by
      FROM public.classes_students enrollment
      WHERE enrollment.class_id = v_class_id
        AND enrollment.enrolled_at <= (v_occurrence->>'start_at')::TIMESTAMPTZ
        AND (enrollment.unenrolled_at IS NULL OR enrollment.unenrolled_at > (v_occurrence->>'start_at')::TIMESTAMPTZ)
      ON CONFLICT (session_id, student_id) DO NOTHING;
    END IF;

    PERFORM set_config('app.sessions_staff_assignment_source', 'class_staff_sync', TRUE);
    INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
    SELECT gen_random_uuid(), v_session_id, assignment.staff_id, 'MAIN_TUTOR', v_created_by
    FROM public.classes_staff assignment
    WHERE assignment.class_id = v_class_id
      AND assignment.assigned_at <= (v_occurrence->>'start_at')::TIMESTAMPTZ
      AND (assignment.unassigned_at IS NULL OR assignment.unassigned_at > (v_occurrence->>'start_at')::TIMESTAMPTZ)
    ON CONFLICT (session_id, staff_id) DO NOTHING;
    PERFORM set_config(
      'app.sessions_staff_assignment_source',
      COALESCE(v_previous_assignment_source, ''),
      TRUE
    );
  END LOOP;

  PERFORM public.refresh_class_schedule_projection(v_class_id);
  PERFORM set_config('app.class_schedule_apply', COALESCE(v_previous_schedule_apply, ''), TRUE);

  RETURN v_plan || jsonb_build_object('class_id', v_class_id, 'schedule_revision_id', v_revision_id);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config(
    'app.sessions_staff_assignment_source',
    COALESCE(v_previous_assignment_source, ''),
    TRUE
  );
  PERFORM set_config('app.class_schedule_apply', COALESCE(v_previous_schedule_apply, ''), TRUE);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_class_schedule_core(JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_class_schedule_core(JSONB, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_class_schedule(
  p_proposal JSONB,
  p_expected_proposal_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_offering_type_text TEXT := COALESCE(NULLIF(p_proposal->>'session_type', ''), 'CLASS');
  v_billing_type_text TEXT := NULLIF(p_proposal->>'billing_type', '');
  v_previous_offering_type TEXT := current_setting('app.class_session_type', TRUE);
  v_previous_billing_type TEXT := current_setting('app.class_billing_type', TRUE);
  v_result JSONB;
BEGIN
  IF CURRENT_USER NOT IN ('postgres', 'service_role')
     AND NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE = '42501';
  END IF;

  IF v_offering_type_text NOT IN ('CLASS', 'HOMEWORK_HELP') THEN
    RAISE EXCEPTION 'Unsupported Scheduled offering type: %', v_offering_type_text;
  END IF;
  IF v_offering_type_text = 'CLASS'
     AND v_billing_type_text NOT IN ('CLASS', 'EXAM_COURSE', 'DRAFTING') THEN
    RAISE EXCEPTION 'Unknown Class billing type: %', v_billing_type_text;
  END IF;
  IF v_offering_type_text = 'HOMEWORK_HELP' AND v_billing_type_text IS NOT NULL THEN
    RAISE EXCEPTION 'Homework Help is non-billable';
  END IF;

  PERFORM set_config('app.class_session_type', v_offering_type_text, TRUE);
  PERFORM set_config('app.class_billing_type', COALESCE(v_billing_type_text, ''), TRUE);
  v_result := public.apply_class_schedule_core(p_proposal, p_expected_proposal_hash);
  PERFORM set_config('app.class_session_type', COALESCE(v_previous_offering_type, ''), TRUE);
  PERFORM set_config('app.class_billing_type', COALESCE(v_previous_billing_type, ''), TRUE);
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.class_session_type', COALESCE(v_previous_offering_type, ''), TRUE);
  PERFORM set_config('app.class_billing_type', COALESCE(v_previous_billing_type, ''), TRUE);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_class_schedule(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_class_schedule(JSONB, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_class_schedule(JSONB, TEXT) IS
  'Applies one previewed effective-dated Scheduled offering configuration and materializes its Sessions atomically.';

CREATE OR REPLACE FUNCTION public.refresh_class_schedule_projection(p_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_class RECORD;
  v_revision RECORD;
  v_summary_short TEXT;
  v_summary_long TEXT;
  v_weekdays SMALLINT[] := '{}'::SMALLINT[];
  v_schedule_rows JSONB := '[]'::JSONB;
  v_identity_short TEXT;
  v_identity_long TEXT;
  v_today DATE;
BEGIN
  SELECT class.*, subject.short_name AS subject_short,
         subject.long_name AS subject_long, subject.name AS subject_name
  INTO v_class
  FROM public.classes class
  LEFT JOIN public.subjects subject ON subject.id = class.subject_id
  WHERE class.id = p_class_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_today := (NOW() AT TIME ZONE v_class.schedule_timezone)::DATE;
  IF v_class.session_type = 'HOMEWORK_HELP'::public.session_type THEN
    v_identity_short := CONCAT_WS(' ', 'Homework Help', NULLIF(BTRIM(v_class.cohort_label), ''));
    v_identity_long := v_identity_short;
  ELSE
    v_identity_short := CONCAT_WS(' ',
      COALESCE(NULLIF(BTRIM(v_class.subject_short), ''), NULLIF(BTRIM(v_class.subject_name), ''), 'Class'),
      NULLIF(BTRIM(v_class.cohort_label), '')
    );
    v_identity_long := CONCAT_WS(' ',
      COALESCE(NULLIF(BTRIM(v_class.subject_long), ''), NULLIF(BTRIM(v_class.subject_name), ''), v_identity_short),
      NULLIF(BTRIM(v_class.cohort_label), '')
    );
  END IF;

  SELECT revision.*
  INTO v_revision
  FROM public.class_schedule_revisions revision
  WHERE revision.class_id = p_class_id
    AND revision.superseded_at IS NULL
    AND revision.effective_to >= v_today
  ORDER BY
    (v_today BETWEEN revision.effective_from AND revision.effective_to) DESC,
    CASE WHEN revision.effective_from > v_today THEN revision.effective_from END ASC NULLS LAST,
    revision.effective_from DESC,
    revision.created_at DESC
  LIMIT 1;

  IF FOUND AND v_revision.schedule_type = 'RECURRING' THEN
    SELECT
      string_agg(
        CASE slot.day_of_week
          WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed'
          WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat'
        END || ' ' || TO_CHAR(slot.start_time, 'FMHH12:MI'),
        ', ' ORDER BY slot.position, slot.day_of_week, slot.start_time
      ),
      string_agg(
        CASE slot.day_of_week
          WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday'
        END || ' ' || TO_CHAR(slot.start_time, 'FMHH12:MI am') || '–' || TO_CHAR(slot.end_time, 'FMHH12:MI am'),
        ', ' ORDER BY slot.position, slot.day_of_week, slot.start_time
      )
    INTO v_summary_short, v_summary_long
    FROM public.class_schedule_slots slot
    WHERE slot.schedule_revision_id = v_revision.id;

    SELECT COALESCE(array_agg(days.day_of_week ORDER BY days.day_of_week), '{}'::SMALLINT[])
    INTO v_weekdays
    FROM (
      SELECT DISTINCT slot.day_of_week
      FROM public.class_schedule_slots slot
      WHERE slot.schedule_revision_id = v_revision.id
    ) days;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', slot.id,
      'day_of_week', slot.day_of_week,
      'start_time', slot.start_time,
      'end_time', slot.end_time,
      'room', slot.room,
      'position', slot.position
    ) ORDER BY slot.position, slot.day_of_week, slot.start_time), '[]'::JSONB)
    INTO v_schedule_rows
    FROM public.class_schedule_slots slot
    WHERE slot.schedule_revision_id = v_revision.id;

    IF v_revision.frequency_weeks = 2 THEN
      v_summary_short := CONCAT(v_summary_short, ' · fortnightly');
      v_summary_long := CONCAT(v_summary_long, ', fortnightly');
    END IF;
  ELSIF FOUND AND v_revision.schedule_type = 'CUSTOM' THEN
    SELECT
      COUNT(*)::TEXT || ' sessions',
      COUNT(*)::TEXT || ' sessions, ' ||
        TO_CHAR(MIN(session.start_at AT TIME ZONE v_class.schedule_timezone), 'FMMon DD') || '–' ||
        TO_CHAR(MAX(session.start_at AT TIME ZONE v_class.schedule_timezone), 'FMMon DD, YYYY')
    INTO v_summary_short, v_summary_long
    FROM public.sessions session
    WHERE session.class_id = p_class_id
      AND session.schedule_revision_id = v_revision.id
      AND session.status = 'ACTIVE';
  END IF;

  UPDATE public.classes class
  SET
    schedule_summary_short = NULLIF(v_summary_short, ''),
    schedule_summary_long = NULLIF(v_summary_long, ''),
    schedule_weekdays = v_weekdays,
    schedule_rows = v_schedule_rows,
    schedule_frequency_weeks = v_revision.frequency_weeks,
    schedule_anchor_date = v_revision.anchor_date,
    short_name = CONCAT(v_identity_short, CASE WHEN v_summary_short IS NOT NULL THEN ' · ' || v_summary_short ELSE '' END),
    long_name = CONCAT(v_identity_long, CASE WHEN v_summary_long IS NOT NULL THEN ' · ' || v_summary_long ELSE '' END),
    next_session_start_at = (
      SELECT MIN(session.start_at)
      FROM public.sessions session
      WHERE session.class_id = p_class_id
        AND session.status = 'ACTIVE'
        AND session.start_at >= NOW()
    )
  WHERE class.id = p_class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_class_schedule_projection(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_class_schedule_projection(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_class_identity_status_to_future_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_previous_schedule_apply TEXT := current_setting('app.class_schedule_apply', TRUE);
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND v_previous_schedule_apply IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Scheduled offering status changes must use the timetable preview';
  END IF;

  IF (
       OLD.subject_id IS DISTINCT FROM NEW.subject_id
       OR OLD.session_type IS DISTINCT FROM NEW.session_type
     ) AND v_previous_schedule_apply IS DISTINCT FROM 'true' THEN
    PERFORM set_config('app.class_schedule_apply', 'true', TRUE);
    UPDATE public.sessions session
    SET
      type = NEW.session_type,
      subject_id = CASE
        WHEN NEW.session_type = 'HOMEWORK_HELP'::public.session_type THEN NULL
        ELSE NEW.subject_id
      END
    WHERE session.class_id = NEW.id
      AND session.start_at >= NOW()
      AND NOT session.is_schedule_exception;
    PERFORM set_config('app.class_schedule_apply', COALESCE(v_previous_schedule_apply, ''), TRUE);
  END IF;

  PERFORM public.refresh_class_schedule_projection(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_class_identity_status_to_future_sessions ON public.classes;
CREATE TRIGGER trigger_sync_class_identity_status_to_future_sessions
  AFTER UPDATE OF session_type, subject_id, cohort_label, status ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_class_identity_status_to_future_sessions();

DO $$
DECLARE
  v_class_id UUID;
BEGIN
  FOR v_class_id IN SELECT id FROM homework_help_migration_targets
  LOOP
    PERFORM public.refresh_class_schedule_projection(v_class_id);
  END LOOP;
END;
$$;
