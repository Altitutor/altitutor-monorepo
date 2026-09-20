-- Cancelled timetable occurrences are calendar history, never billable lessons.
CREATE OR REPLACE FUNCTION public.session_student_is_chargeable(
  p_sessions_students_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_student_id uuid;
  v_planned_absence boolean;
  v_is_credited boolean;
  v_is_rescheduled boolean;
  v_was_trial boolean;
  v_billing_type public.billing_type;
  v_session_active boolean;
  v_attended boolean;
  v_actual_was_trial boolean;
  v_treatment text;
BEGIN
  SELECT
    ss.session_id,
    ss.student_id,
    ss.planned_absence,
    ss.is_credited,
    ss.is_rescheduled,
    ss.was_trial,
    s.billing_type,
    s.status = 'ACTIVE' AND s.calendar_tombstone_until IS NULL
  INTO
    v_session_id,
    v_student_id,
    v_planned_absence,
    v_is_credited,
    v_is_rescheduled,
    v_was_trial,
    v_billing_type,
    v_session_active
  FROM public.sessions_students ss
  JOIN public.sessions s ON s.id = ss.session_id
  WHERE ss.id = p_sessions_students_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session student assignment not found: %', p_sessions_students_id;
  END IF;

  SELECT
    COALESCE(bool_or(tlsa.attended), false),
    COALESCE(bool_or(tlsa.was_trial), false)
  INTO v_attended, v_actual_was_trial
  FROM public.tutor_logs tl
  JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
  WHERE tl.session_id = v_session_id
    AND tlsa.student_id = v_student_id;

  v_treatment := public.derive_session_absence_billing_treatment(
    v_planned_absence,
    v_is_credited,
    v_is_rescheduled
  );

  RETURN v_session_active AND v_billing_type IS NOT NULL
    AND NOT (v_was_trial OR v_actual_was_trial)
    AND (
      v_attended
      OR NOT v_planned_absence
      OR v_treatment = 'charge'
    );
END;
$$;

-- Keep the previous absence treatment only while it is managed by an enrolment
-- end. A later independent absence edit takes ownership and discards the snapshot.
ALTER TABLE public.sessions_students ADD COLUMN enrolment_absence_snapshot jsonb;
CREATE FUNCTION public.clear_enrolment_absence_snapshot_on_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('app.sessions_student_assignment_source', true) IS DISTINCT FROM 'class_student_sync'
    AND ROW(NEW.planned_absence, NEW.planned_absence_logged_at, NEW.planned_absence_logged_by,
      NEW.is_credited, NEW.credited_at, NEW.credited_by, NEW.is_rescheduled)
    IS DISTINCT FROM ROW(OLD.planned_absence, OLD.planned_absence_logged_at, OLD.planned_absence_logged_by,
      OLD.is_credited, OLD.credited_at, OLD.credited_by, OLD.is_rescheduled)
  THEN
    NEW.enrolment_absence_snapshot := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_enrolment_absence_snapshot_on_edit() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER clear_enrolment_absence_snapshot_on_edit
BEFORE UPDATE ON public.sessions_students
FOR EACH ROW EXECUTE FUNCTION public.clear_enrolment_absence_snapshot_on_edit();

-- Preserve financial/attendance history when removing enrolment-derived assignments.
-- Both first-time and corrected scheduled ends must reconcile the excluded interval.
CREATE OR REPLACE FUNCTION public.sync_student_sessions_on_unenrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_assignment record;
  v_previous_source text := current_setting('app.sessions_student_assignment_source', true);
BEGIN
  IF OLD.unenrolled_at IS NOT DISTINCT FROM NEW.unenrolled_at THEN RETURN NEW; END IF;
  PERFORM set_config('app.sessions_student_assignment_source', 'class_student_sync', true);
  IF NEW.unenrolled_at IS NOT NULL THEN
    FOR v_assignment IN
      SELECT ss.* FROM public.sessions_students ss
      JOIN public.sessions s ON s.id = ss.session_id
      WHERE ss.student_id = NEW.student_id AND s.class_id = NEW.class_id
        AND s.start_at >= NEW.unenrolled_at AND s.start_at >= OLD.enrolled_at
        AND (OLD.unenrolled_at IS NULL OR s.start_at < OLD.unenrolled_at)
        AND NOT EXISTS (
          SELECT 1 FROM public.classes_students other
          WHERE other.id <> NEW.id AND other.student_id = NEW.student_id
            AND other.class_id = NEW.class_id AND s.start_at >= other.enrolled_at
            AND (other.unenrolled_at IS NULL OR s.start_at < other.unenrolled_at)
        )
      FOR UPDATE OF ss
    LOOP
      IF EXISTS (SELECT 1 FROM public.invoice_items WHERE sessions_students_id = v_assignment.id)
        OR EXISTS (SELECT 1 FROM public.session_billing_adjustments WHERE sessions_students_id = v_assignment.id)
        OR EXISTS (SELECT 1 FROM public.tutor_logs tl JOIN public.tutor_logs_student_attendance a ON a.tutor_log_id=tl.id WHERE tl.session_id=v_assignment.session_id AND a.student_id=NEW.student_id)
        OR v_assignment.planned_absence
        OR EXISTS (SELECT 1 FROM public.sessions_students WHERE rescheduled_sessions_students_id=v_assignment.id)
      THEN
        -- Existing replacement arrangements remain intact. Attendance still takes
        -- precedence over credit treatment under the canonical billing policy.
        IF NOT v_assignment.is_rescheduled THEN
          UPDATE public.sessions_students SET
            enrolment_absence_snapshot=COALESCE(enrolment_absence_snapshot,jsonb_build_object(
              'enrolment_id', NEW.id,
              'planned_absence', planned_absence,
              'planned_absence_logged_at', planned_absence_logged_at,
              'planned_absence_logged_by', planned_absence_logged_by,
              'is_credited', is_credited, 'credited_at', credited_at, 'credited_by', credited_by
            )),
            planned_absence=true,
            planned_absence_logged_at=now(), planned_absence_logged_by=NEW.unenrolled_by,
            is_credited=true, credited_at=now(), credited_by=NEW.unenrolled_by
          WHERE id=v_assignment.id;
        END IF;
        PERFORM public.enqueue_session_billing_adjustment(v_assignment.id,NEW.unenrolled_by,
          'admin_discretion','Class enrolment ended before this session');
      ELSE
        DELETE FROM public.sessions_students WHERE id=v_assignment.id;
      END IF;
    END LOOP;
  END IF;
  -- Extending an end date restores missing assignments without overwriting
  -- independently recorded absences, replacements or financial history.
  IF OLD.unenrolled_at IS NOT NULL AND (NEW.unenrolled_at IS NULL OR NEW.unenrolled_at > OLD.unenrolled_at) THEN
    FOR v_assignment IN
      SELECT ss.* FROM public.sessions_students ss
      JOIN public.sessions s ON s.id=ss.session_id
      WHERE ss.student_id=NEW.student_id AND s.class_id=NEW.class_id
        AND ss.enrolment_absence_snapshot->>'enrolment_id'=NEW.id::text
        AND s.start_at >= GREATEST(NEW.enrolled_at,OLD.unenrolled_at)
        AND (NEW.unenrolled_at IS NULL OR s.start_at < NEW.unenrolled_at)
      FOR UPDATE OF ss
    LOOP
      UPDATE public.sessions_students SET
        planned_absence=(enrolment_absence_snapshot->>'planned_absence')::boolean,
        planned_absence_logged_at=(enrolment_absence_snapshot->>'planned_absence_logged_at')::timestamptz,
        planned_absence_logged_by=(enrolment_absence_snapshot->>'planned_absence_logged_by')::uuid,
        is_credited=(enrolment_absence_snapshot->>'is_credited')::boolean,
        credited_at=(enrolment_absence_snapshot->>'credited_at')::timestamptz,
        credited_by=(enrolment_absence_snapshot->>'credited_by')::uuid,
        enrolment_absence_snapshot=NULL
      WHERE id=v_assignment.id;
      PERFORM public.enqueue_session_billing_adjustment(v_assignment.id,NEW.unenrolled_by,
        'admin_discretion','Class enrolment end corrected to include this session');
    END LOOP;
    INSERT INTO public.sessions_students(id,session_id,student_id,created_by)
    SELECT gen_random_uuid(),s.id,NEW.student_id,NEW.enrolled_by FROM public.sessions s
    WHERE s.class_id=NEW.class_id AND s.status='ACTIVE' AND s.calendar_tombstone_until IS NULL
      AND s.start_at >= GREATEST(NEW.enrolled_at,OLD.unenrolled_at)
      AND (NEW.unenrolled_at IS NULL OR s.start_at < NEW.unenrolled_at)
    ON CONFLICT(session_id,student_id) DO NOTHING;
  END IF;
  PERFORM set_config('app.sessions_student_assignment_source',COALESCE(v_previous_source,''),true);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.sessions_student_assignment_source',COALESCE(v_previous_source,''),true);
  RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_student_sessions_on_unenrollment() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.end_student_class_enrolment(
  p_student_id uuid, p_class_id uuid, p_unenrolled_at timestamptz,
  p_staff_id uuid, p_reason jsonb DEFAULT NULL
) RETURNS uuid[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_enrolment public.classes_students%ROWTYPE;
  v_adjustments uuid[];
BEGIN
  IF current_user NOT IN ('postgres','service_role') AND NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Only active admin staff may change class enrolments' USING ERRCODE='42501';
  END IF;
  IF p_unenrolled_at IS NULL THEN RAISE EXCEPTION 'An enrolment end date is required'; END IF;
  PERFORM 1 FROM public.students WHERE id=p_student_id FOR UPDATE;
  SELECT * INTO v_enrolment FROM public.classes_students
  WHERE student_id=p_student_id AND class_id=p_class_id
    AND (unenrolled_at IS NULL OR unenrolled_at > now())
  ORDER BY enrolled_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current or scheduled class enrolment not found'; END IF;
  IF p_unenrolled_at <= v_enrolment.enrolled_at THEN
    RAISE EXCEPTION 'The final class date must not precede the enrolment start';
  END IF;
  UPDATE public.classes_students SET unenrolled_at=p_unenrolled_at,unenrolled_by=p_staff_id
  WHERE id=v_enrolment.id;
  IF p_reason IS NOT NULL THEN
    INSERT INTO public.notes(target_type,target_id,note,created_by)
    VALUES ('classes_students',v_enrolment.id,p_reason,p_staff_id);
  END IF;
  SELECT COALESCE(array_agg(a.id),ARRAY[]::uuid[]) INTO v_adjustments
  FROM public.session_billing_adjustments a
  JOIN public.sessions_students ss ON ss.id=a.sessions_students_id
  JOIN public.sessions s ON s.id=ss.session_id
  WHERE ss.student_id=p_student_id AND s.class_id=p_class_id
    AND a.status IN ('pending','retryable');
  RETURN v_adjustments;
END;
$$;
REVOKE ALL ON FUNCTION public.end_student_class_enrolment(uuid,uuid,timestamptz,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.end_student_class_enrolment(uuid,uuid,timestamptz,uuid,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.change_student_class(
  p_student_id uuid, p_old_class_id uuid, p_new_class_id uuid,
  p_last_old_date date, p_first_new_date date, p_staff_id uuid
) RETURNS uuid[] LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_old_timezone text;
  v_new_timezone text;
  v_first_at timestamptz;
  v_adjustments uuid[];
BEGIN
  IF current_user NOT IN ('postgres','service_role') AND NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Only active admin staff may change class enrolments' USING ERRCODE='42501';
  END IF;
  IF p_last_old_date IS NULL OR p_first_new_date IS NULL OR p_last_old_date >= p_first_new_date THEN
    RAISE EXCEPTION 'The first new class date must be after the final old class date';
  END IF;
  IF p_old_class_id=p_new_class_id THEN RAISE EXCEPTION 'Choose a different destination class'; END IF;
  PERFORM 1 FROM public.students WHERE id=p_student_id AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student must be active to enrol in a class'; END IF;
  SELECT schedule_timezone INTO STRICT v_old_timezone FROM public.classes WHERE id=p_old_class_id;
  SELECT schedule_timezone INTO STRICT v_new_timezone FROM public.classes WHERE id=p_new_class_id AND status='ACTIVE' AND session_type='CLASS';
  v_first_at := p_first_new_date::timestamp AT TIME ZONE v_new_timezone;
  IF EXISTS(SELECT 1 FROM public.classes_students WHERE student_id=p_student_id AND class_id=p_new_class_id AND (unenrolled_at IS NULL OR unenrolled_at>v_first_at)) THEN
    RAISE EXCEPTION 'Student is already enrolled in the new class';
  END IF;
  v_adjustments := public.end_student_class_enrolment(p_student_id,p_old_class_id,
    (p_last_old_date+1)::timestamp AT TIME ZONE v_old_timezone,p_staff_id);
  INSERT INTO public.classes_students(id,class_id,student_id,enrolled_at,enrolled_by)
  VALUES(gen_random_uuid(),p_new_class_id,p_student_id,v_first_at,p_staff_id);
  RETURN v_adjustments;
END;
$$;
REVOKE ALL ON FUNCTION public.change_student_class(uuid,uuid,uuid,date,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_student_class(uuid,uuid,uuid,date,date,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.sync_student_sessions_on_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  sessions_affected INTEGER := 0;
  previous_source TEXT := current_setting('app.sessions_student_assignment_source', TRUE);
BEGIN
  PERFORM set_config('app.sessions_student_assignment_source', 'class_student_sync', TRUE);
  BEGIN
    INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
    SELECT gen_random_uuid(), session.id, NEW.student_id, NEW.enrolled_by
    FROM public.sessions session
    WHERE session.class_id = NEW.class_id
      AND session.start_at >= NEW.enrolled_at
      AND (NEW.unenrolled_at IS NULL OR session.start_at < NEW.unenrolled_at)
      AND session.status = 'ACTIVE' AND session.calendar_tombstone_until IS NULL
    ON CONFLICT (session_id, student_id) DO NOTHING;
    GET DIAGNOSTICS sessions_affected = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.sessions_student_assignment_source', COALESCE(previous_source, ''), TRUE);
    RAISE;
  END;
  PERFORM set_config('app.sessions_student_assignment_source', COALESCE(previous_source, ''), TRUE);
  RAISE NOTICE 'Enrolled student % in % sessions starting from %', NEW.student_id, sessions_affected, NEW.enrolled_at;
  RETURN NEW;
END;
$function$;


ALTER TABLE public.classes ADD COLUMN schedule_projected_on date;
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
    v_identity_short := 'Homework help';
    v_identity_long := 'Homework help';
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
    schedule_projected_on = v_today,
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

CREATE OR REPLACE FUNCTION public.refresh_due_class_schedule_projections()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.classes
    WHERE status='ACTIVE' AND (
      schedule_projected_on IS DISTINCT FROM (now() AT TIME ZONE schedule_timezone)::date
      OR next_session_start_at < now()
    )
  LOOP
    PERFORM public.refresh_class_schedule_projection(v_id);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_due_class_schedule_projections() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_due_class_schedule_projections() TO service_role;
-- Local stacks may not preload pg_cron; hosted environments already use it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-class-schedule-projections',
      '*/10 * * * *',
      'SELECT public.refresh_due_class_schedule_projections();'
    );
  END IF;
END;
$$;
