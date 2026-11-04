-- Effective-dated Admin shift schedules, using the Class revision contract:
-- today-or-later changes, a preview, and preservation of past and enriched Sessions.
-- Billing and payroll calculations are unchanged. Pay metrics still count attended tutor logs.

CREATE TABLE public.admin_shift_schedule_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_shift_id UUID NOT NULL REFERENCES public.admin_shifts(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  superseded_at TIMESTAMPTZ,
  CHECK (start_time < end_time),
  CHECK (effective_from <= effective_to)
);

CREATE INDEX admin_shift_schedule_revisions_shift_effective_idx
  ON public.admin_shift_schedule_revisions (admin_shift_id, effective_from, effective_to);

CREATE UNIQUE INDEX admin_shift_schedule_revisions_one_authoritative_start_idx
  ON public.admin_shift_schedule_revisions (admin_shift_id, effective_from)
  WHERE superseded_at IS NULL;

ALTER TABLE public.admin_shift_schedule_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to admin shift schedule revisions"
  ON public.admin_shift_schedule_revisions
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_shift_schedule_revisions TO authenticated;

COMMENT ON TABLE public.admin_shift_schedule_revisions IS
  'Effective-dated weekday and time for an Admin shift. The row in force today is the current schedule.';

CREATE OR REPLACE FUNCTION public.normalize_admin_shift_bounds()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.session_start_date IS NULL THEN
    NEW.session_start_date := (pg_catalog.now() AT TIME ZONE 'Australia/Adelaide')::DATE;
  END IF;

  IF NEW.session_end_date IS NULL THEN
    NEW.session_end_date := (
      pg_catalog.date_trunc('year', NEW.session_start_date::TIMESTAMP)
      + INTERVAL '1 year'
      - INTERVAL '1 day'
    )::DATE;
  END IF;

  IF NEW.session_start_date > NEW.session_end_date THEN
    RAISE EXCEPTION 'Admin shift end date must be on or after its start date'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_normalize_admin_shift_bounds ON public.admin_shifts;
CREATE TRIGGER trigger_normalize_admin_shift_bounds
BEFORE INSERT ON public.admin_shifts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_admin_shift_bounds();

CREATE OR REPLACE FUNCTION public.is_pristine_generated_admin_shift_session(p_session_id UUID)
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
      AND session.type = 'ADMIN_SHIFT'::public.session_type
      AND session.schedule_origin = 'GENERATED'
      AND NOT session.is_schedule_exception
      AND session.original_start_at = session.start_at
      AND session.original_end_at = session.end_at
      AND NOT EXISTS (
        SELECT 1 FROM public.sessions_students student
        WHERE student.session_id = session.id
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

REVOKE ALL ON FUNCTION public.is_pristine_generated_admin_shift_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pristine_generated_admin_shift_session(UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.is_pristine_generated_admin_shift_session(UUID) IS
  'True when an Admin shift Session is still an untouched generated occurrence. Appointments and operational history protect it.';

CREATE OR REPLACE FUNCTION public.refresh_admin_shift_schedule_projection(p_admin_shift_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_today DATE := (pg_catalog.now() AT TIME ZONE 'Australia/Adelaide')::DATE;
  v_revision public.admin_shift_schedule_revisions%ROWTYPE;
  v_previous_shift_apply TEXT := pg_catalog.current_setting('app.admin_shift_schedule_apply', TRUE);
BEGIN
  SELECT revision.*
  INTO v_revision
  FROM public.admin_shift_schedule_revisions revision
  WHERE revision.admin_shift_id = p_admin_shift_id
    AND revision.superseded_at IS NULL
    AND revision.effective_to >= v_today
  ORDER BY
    (v_today BETWEEN revision.effective_from AND revision.effective_to) DESC,
    revision.effective_from ASC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT revision.*
    INTO v_revision
    FROM public.admin_shift_schedule_revisions revision
    WHERE revision.admin_shift_id = p_admin_shift_id
      AND revision.superseded_at IS NULL
    ORDER BY revision.effective_to DESC, revision.effective_from DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.set_config('app.admin_shift_schedule_apply', 'true', TRUE);

  UPDATE public.admin_shifts shift
  SET
    day_of_week = v_revision.day_of_week,
    start_time = pg_catalog.to_char(v_revision.start_time, 'HH24:MI'),
    end_time = pg_catalog.to_char(v_revision.end_time, 'HH24:MI'),
    status = v_revision.status
  WHERE shift.id = p_admin_shift_id
    AND (
      shift.day_of_week IS DISTINCT FROM v_revision.day_of_week
      OR shift.start_time::TIME IS DISTINCT FROM v_revision.start_time
      OR shift.end_time::TIME IS DISTINCT FROM v_revision.end_time
      OR shift.status IS DISTINCT FROM v_revision.status
    );

  PERFORM pg_catalog.set_config(
    'app.admin_shift_schedule_apply',
    COALESCE(v_previous_shift_apply, ''),
    TRUE
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config(
    'app.admin_shift_schedule_apply',
    COALESCE(v_previous_shift_apply, ''),
    TRUE
  );
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_admin_shift_schedule_projection(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_admin_shift_schedule_projection(UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.precreate_admin_shift_sessions(
  start_date DATE,
  end_date DATE,
  p_created_by UUID DEFAULT NULL,
  p_admin_shift_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  d DATE;
  a RECORD;
  inserted_count INTEGER := 0;
  new_session_id UUID;
  s_at TIMESTAMPTZ;
  e_at TIMESTAMPTZ;
  actual_start_date DATE;
  actual_end_date DATE;
  window_start DATE;
  window_end DATE;
  v_previous_assignment_source TEXT := pg_catalog.current_setting('app.sessions_staff_assignment_source', TRUE);
  v_previous_schedule_apply TEXT := pg_catalog.current_setting('app.class_schedule_apply', TRUE);
BEGIN
  IF p_admin_shift_id IS NULL AND start_date IS NULL AND end_date IS NULL THEN
    actual_start_date := (pg_catalog.now() AT TIME ZONE 'Australia/Adelaide')::DATE;
    actual_end_date := (
      pg_catalog.date_trunc('year', actual_start_date::TIMESTAMP)
      + INTERVAL '1 year'
      - INTERVAL '1 day'
    )::DATE;
  ELSIF start_date IS NULL OR end_date IS NULL THEN
    RETURN 0;
  ELSE
    actual_start_date := start_date;
    actual_end_date := end_date;
  END IF;

  IF actual_start_date > actual_end_date THEN
    RETURN 0;
  END IF;

  PERFORM public.refresh_admin_shift_schedule_projection(shift.id)
  FROM public.admin_shifts shift
  WHERE (p_admin_shift_id IS NULL OR shift.id = p_admin_shift_id)
    AND shift.deleted_at IS NULL;

  PERFORM pg_catalog.set_config('app.class_schedule_apply', 'true', TRUE);
  PERFORM pg_catalog.set_config('app.sessions_staff_assignment_source', 'class_staff_sync', TRUE);

  FOR a IN
    SELECT
      revision.admin_shift_id,
      revision.day_of_week,
      revision.start_time,
      revision.end_time,
      revision.effective_from,
      revision.effective_to
    FROM public.admin_shift_schedule_revisions revision
    JOIN public.admin_shifts shift ON shift.id = revision.admin_shift_id
    WHERE revision.superseded_at IS NULL
      AND revision.status = 'ACTIVE'
      AND shift.deleted_at IS NULL
      AND (p_admin_shift_id IS NULL OR revision.admin_shift_id = p_admin_shift_id)
  LOOP
    window_start := GREATEST(actual_start_date, a.effective_from);
    window_end := LEAST(actual_end_date, a.effective_to);
    d := window_start;

    WHILE d <= window_end LOOP
      IF EXTRACT(DOW FROM d)::INTEGER = a.day_of_week THEN
        s_at := (d + a.start_time) AT TIME ZONE 'Australia/Adelaide';
        e_at := (d + a.end_time) AT TIME ZONE 'Australia/Adelaide';

        SELECT session.id
        INTO new_session_id
        FROM public.sessions session
        WHERE session.admin_shift_id = a.admin_shift_id
          AND session.start_at = s_at
          AND session.end_at = e_at
        LIMIT 1;

        IF new_session_id IS NULL THEN
          INSERT INTO public.sessions (
            id,
            start_at,
            end_at,
            type,
            admin_shift_id,
            status,
            schedule_origin,
            is_schedule_exception,
            original_start_at,
            original_end_at
          ) VALUES (
            pg_catalog.gen_random_uuid(),
            s_at,
            e_at,
            'ADMIN_SHIFT',
            a.admin_shift_id,
            'ACTIVE',
            'GENERATED',
            FALSE,
            s_at,
            e_at
          )
          RETURNING id INTO new_session_id;
          inserted_count := inserted_count + 1;
        END IF;

        INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
        SELECT
          pg_catalog.gen_random_uuid(),
          new_session_id,
          assignment.staff_id,
          'MAIN_TUTOR',
          p_created_by
        FROM public.admin_shifts_staff assignment
        WHERE assignment.admin_shift_id = a.admin_shift_id
          AND assignment.assigned_at <= s_at
          AND (assignment.unassigned_at IS NULL OR assignment.unassigned_at > s_at)
          AND NOT EXISTS (
            SELECT 1
            FROM public.sessions_staff existing
            WHERE existing.session_id = new_session_id
              AND existing.staff_id = assignment.staff_id
          )
        ON CONFLICT (session_id, staff_id) DO NOTHING;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  PERFORM pg_catalog.set_config('app.class_schedule_apply', COALESCE(v_previous_schedule_apply, ''), TRUE);
  PERFORM pg_catalog.set_config(
    'app.sessions_staff_assignment_source',
    COALESCE(v_previous_assignment_source, ''),
    TRUE
  );
  RETURN inserted_count;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('app.class_schedule_apply', COALESCE(v_previous_schedule_apply, ''), TRUE);
  PERFORM pg_catalog.set_config(
    'app.sessions_staff_assignment_source',
    COALESCE(v_previous_assignment_source, ''),
    TRUE
  );
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.precreate_admin_shift_sessions(DATE, DATE, UUID, UUID) IS
  'Creates missing Admin shift Sessions from the revision in force on each date.';

CREATE OR REPLACE FUNCTION public.create_sessions_on_admin_shift_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_previous_shift_apply TEXT := pg_catalog.current_setting('app.admin_shift_schedule_apply', TRUE);
BEGIN
  INSERT INTO public.admin_shift_schedule_revisions (
    admin_shift_id,
    day_of_week,
    start_time,
    end_time,
    status,
    effective_from,
    effective_to,
    created_by
  ) VALUES (
    NEW.id,
    NEW.day_of_week::SMALLINT,
    NEW.start_time::TIME,
    NEW.end_time::TIME,
    NEW.status,
    NEW.session_start_date,
    NEW.session_end_date,
    NEW.created_by
  );

  PERFORM pg_catalog.set_config('app.admin_shift_schedule_apply', 'true', TRUE);
  PERFORM public.precreate_admin_shift_sessions(
    NEW.session_start_date,
    NEW.session_end_date,
    NEW.created_by,
    NEW.id
  );
  PERFORM pg_catalog.set_config(
    'app.admin_shift_schedule_apply',
    COALESCE(v_previous_shift_apply, ''),
    TRUE
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config(
    'app.admin_shift_schedule_apply',
    COALESCE(v_previous_shift_apply, ''),
    TRUE
  );
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_sessions_on_admin_shift_date_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF pg_catalog.current_setting('app.admin_shift_schedule_apply', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Admin shift schedule changes must use the timetable preview'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_sessions_on_admin_shift_property_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF pg_catalog.current_setting('app.admin_shift_schedule_apply', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Admin shift schedule changes must use the timetable preview'
    USING ERRCODE = 'P0001';
END;
$$;

COMMENT ON FUNCTION public.sync_sessions_on_admin_shift_date_update() IS
  'Rejects direct Admin shift date edits so they go through the effective-dated preview.';

COMMENT ON FUNCTION public.sync_sessions_on_admin_shift_property_update() IS
  'Rejects direct Admin shift day, time, and status edits so they go through the effective-dated preview.';

CREATE OR REPLACE FUNCTION public.preview_admin_shift_schedule(p_proposal JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_shift_id UUID := NULLIF(p_proposal->>'admin_shift_id', '')::UUID;
  v_day SMALLINT := NULLIF(p_proposal->>'day_of_week', '')::SMALLINT;
  v_start TIME := NULLIF(p_proposal->>'start_time', '')::TIME;
  v_end TIME := NULLIF(p_proposal->>'end_time', '')::TIME;
  v_status TEXT := COALESCE(NULLIF(p_proposal->>'status', ''), 'ACTIVE');
  v_start_date DATE := (p_proposal->>'start_date')::DATE;
  v_end_date DATE := (p_proposal->>'end_date')::DATE;
  v_effective_from DATE := COALESCE((p_proposal->>'effective_from')::DATE, v_start_date);
  v_timezone TEXT := COALESCE(NULLIF(p_proposal->>'timezone', ''), 'Australia/Adelaide');
  v_date DATE;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_occurrences JSONB := '[]'::JSONB;
  v_reconciled_occurrences JSONB := '[]'::JSONB;
  v_removals JSONB := '[]'::JSONB;
  v_conflicts JSONB := '[]'::JSONB;
  v_row JSONB;
  v_session RECORD;
  v_create_count INTEGER := 0;
  v_preserve_count INTEGER := 0;
  v_cancel_count INTEGER := 0;
  v_protected_count INTEGER := 0;
BEGIN
  IF CURRENT_USER NOT IN ('postgres', 'service_role')
     AND NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE = '42501';
  END IF;

  IF v_shift_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_shifts shift WHERE shift.id = v_shift_id
  ) THEN
    RAISE EXCEPTION 'Admin shift not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('ACTIVE', 'INACTIVE')
     OR v_day IS NULL
     OR v_day NOT BETWEEN 0 AND 6
     OR v_start IS NULL
     OR v_end IS NULL
     OR v_start >= v_end THEN
    RAISE EXCEPTION 'An Admin shift requires a valid weekday and time range'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_start_date IS NULL OR v_end_date IS NULL OR v_start_date > v_end_date THEN
    RAISE EXCEPTION 'A valid Admin shift start and end date are required'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_effective_from < v_start_date OR v_effective_from > v_end_date THEN
    RAISE EXCEPTION 'The schedule effective date must fall within the Admin shift bounds'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone
  ) THEN
    RAISE EXCEPTION 'Unknown Admin shift timezone: %', v_timezone USING ERRCODE = 'P0001';
  END IF;

  IF v_effective_from < (pg_catalog.now() AT TIME ZONE v_timezone)::DATE THEN
    RAISE EXCEPTION 'The schedule effective date must be today or later'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'ACTIVE' THEN
    v_date := v_effective_from;
    WHILE v_date <= v_end_date LOOP
      IF EXTRACT(DOW FROM v_date)::INTEGER = v_day THEN
        v_start_at := (v_date + v_start) AT TIME ZONE v_timezone;
        v_end_at := (v_date + v_end) AT TIME ZONE v_timezone;
        v_occurrences := v_occurrences || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'start_at', v_start_at,
          'end_at', v_end_at,
          'action', 'CREATE'
        ));
      END IF;
      v_date := v_date + 1;
    END LOOP;
  END IF;

  IF pg_catalog.jsonb_array_length(v_occurrences) > 1000 THEN
    RAISE EXCEPTION 'An Admin shift cannot contain more than 1000 Sessions'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(v_occurrences)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.sessions session
      WHERE session.admin_shift_id = v_shift_id
        AND (
          (session.start_at = (v_row->>'start_at')::TIMESTAMPTZ AND session.end_at = (v_row->>'end_at')::TIMESTAMPTZ)
          OR (
            session.is_schedule_exception
            AND session.original_start_at = (v_row->>'start_at')::TIMESTAMPTZ
            AND session.original_end_at = (v_row->>'end_at')::TIMESTAMPTZ
          )
        )
    ) THEN
      v_row := pg_catalog.jsonb_set(v_row, '{action}', '"PRESERVE"'::JSONB);
      v_preserve_count := v_preserve_count + 1;
    ELSE
      v_create_count := v_create_count + 1;
    END IF;
    v_reconciled_occurrences := v_reconciled_occurrences || pg_catalog.jsonb_build_array(v_row);
  END LOOP;

  FOR v_session IN
    SELECT session.id, session.start_at, session.end_at
    FROM public.sessions session
    WHERE session.admin_shift_id = v_shift_id
      AND session.type = 'ADMIN_SHIFT'::public.session_type
      AND session.status = 'ACTIVE'
      AND session.calendar_tombstone_until IS NULL
      AND session.start_at >= v_effective_from::TIMESTAMP AT TIME ZONE v_timezone
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(v_occurrences) planned
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
    IF public.is_pristine_generated_admin_shift_session(v_session.id) THEN
      v_cancel_count := v_cancel_count + 1;
      v_removals := v_removals || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'session_id', v_session.id,
        'start_at', v_session.start_at,
        'end_at', v_session.end_at,
        'action', 'CANCEL'
      ));
    ELSE
      v_protected_count := v_protected_count + 1;
      v_removals := v_removals || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'session_id', v_session.id,
        'start_at', v_session.start_at,
        'end_at', v_session.end_at,
        'action', 'PROTECTED'
      ));
    END IF;
  END LOOP;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'type', conflict_type,
    'message', conflict_message
  ) ORDER BY conflict_type, conflict_message), '[]'::JSONB)
  INTO v_conflicts
  FROM (
    SELECT DISTINCT
      'STAFF'::TEXT AS conflict_type,
      'An assigned staff member is already attached to another Session at ' || (planned->>'start_at') AS conflict_message
    FROM pg_catalog.jsonb_array_elements(v_reconciled_occurrences) planned
    JOIN public.admin_shifts_staff own_staff
      ON own_staff.admin_shift_id = v_shift_id
      AND own_staff.unassigned_at IS NULL
    JOIN public.sessions_staff other_staff ON other_staff.staff_id = own_staff.staff_id
    JOIN public.sessions other ON other.id = other_staff.session_id
      AND other.status = 'ACTIVE'
      AND other.calendar_tombstone_until IS NULL
      AND other.admin_shift_id IS DISTINCT FROM v_shift_id
      AND other.start_at < (planned->>'end_at')::TIMESTAMPTZ
      AND other.end_at > (planned->>'start_at')::TIMESTAMPTZ
  ) conflict_rows;

  RETURN pg_catalog.jsonb_build_object(
    'proposal_hash', encode(extensions.digest(pg_catalog.jsonb_build_object(
      'proposal', p_proposal,
      'occurrences', v_reconciled_occurrences,
      'removals', v_removals
    )::TEXT, 'sha256'), 'hex'),
    'counts', pg_catalog.jsonb_build_object(
      'create', v_create_count,
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

REVOKE ALL ON FUNCTION public.preview_admin_shift_schedule(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_admin_shift_schedule(JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.preview_admin_shift_schedule(JSONB) IS
  'Validates a proposed Admin shift timetable and returns its Session reconciliation without writing that plan.';

CREATE OR REPLACE FUNCTION public.apply_admin_shift_schedule(
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
  v_shift_id UUID := NULLIF(p_proposal->>'admin_shift_id', '')::UUID;
  v_effective_from DATE := (p_proposal->>'effective_from')::DATE;
  v_start_date DATE := (p_proposal->>'start_date')::DATE;
  v_end_date DATE := (p_proposal->>'end_date')::DATE;
  v_timezone TEXT := COALESCE(NULLIF(p_proposal->>'timezone', ''), 'Australia/Adelaide');
  v_status TEXT := COALESCE(NULLIF(p_proposal->>'status', ''), 'ACTIVE');
  v_revision_id UUID := pg_catalog.gen_random_uuid();
  v_created_by UUID := (SELECT public.current_staff_id());
  v_occurrence JSONB;
  v_session_id UUID;
  v_previous_assignment_source TEXT := pg_catalog.current_setting('app.sessions_staff_assignment_source', TRUE);
  v_previous_shift_apply TEXT := pg_catalog.current_setting('app.admin_shift_schedule_apply', TRUE);
  v_previous_class_apply TEXT := pg_catalog.current_setting('app.class_schedule_apply', TRUE);
BEGIN
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'An Admin shift id is required' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_shift_id::TEXT, 0));
  v_plan := public.preview_admin_shift_schedule(p_proposal);
  IF v_plan->>'proposal_hash' IS DISTINCT FROM p_expected_proposal_hash THEN
    RAISE EXCEPTION 'The Admin shift changed after preview; preview it again'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.set_config('app.admin_shift_schedule_apply', 'true', TRUE);
  PERFORM pg_catalog.set_config('app.class_schedule_apply', 'true', TRUE);
  PERFORM pg_catalog.set_config('app.sessions_staff_assignment_source', 'class_staff_sync', TRUE);

  UPDATE public.admin_shift_schedule_revisions
  SET superseded_at = pg_catalog.now()
  WHERE admin_shift_id = v_shift_id
    AND superseded_at IS NULL
    AND effective_from >= v_effective_from;

  UPDATE public.admin_shift_schedule_revisions
  SET effective_to = v_effective_from - 1
  WHERE admin_shift_id = v_shift_id
    AND superseded_at IS NULL
    AND effective_from < v_effective_from
    AND effective_to >= v_effective_from;

  INSERT INTO public.admin_shift_schedule_revisions (
    id,
    admin_shift_id,
    day_of_week,
    start_time,
    end_time,
    status,
    effective_from,
    effective_to,
    created_by
  ) VALUES (
    v_revision_id,
    v_shift_id,
    (p_proposal->>'day_of_week')::SMALLINT,
    (p_proposal->>'start_time')::TIME,
    (p_proposal->>'end_time')::TIME,
    v_status,
    v_effective_from,
    v_end_date,
    v_created_by
  );

  UPDATE public.admin_shifts
  SET
    session_start_date = v_start_date,
    session_end_date = v_end_date
  WHERE id = v_shift_id;

  UPDATE public.sessions session
  SET
    status = 'INACTIVE',
    calendar_tombstone_until = pg_catalog.now() + INTERVAL '90 days'
  WHERE session.admin_shift_id = v_shift_id
    AND session.type = 'ADMIN_SHIFT'::public.session_type
    AND session.status = 'ACTIVE'
    AND session.start_at >= v_effective_from::TIMESTAMP AT TIME ZONE v_timezone
    AND public.is_pristine_generated_admin_shift_session(session.id)
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_plan->'occurrences') planned
      WHERE (
        (planned->>'start_at')::TIMESTAMPTZ = session.start_at
        AND (planned->>'end_at')::TIMESTAMPTZ = session.end_at
      ) OR (
        session.is_schedule_exception
        AND (planned->>'start_at')::TIMESTAMPTZ = session.original_start_at
        AND (planned->>'end_at')::TIMESTAMPTZ = session.original_end_at
      )
    );

  UPDATE public.sessions session
  SET
    status = 'ACTIVE',
    calendar_tombstone_until = NULL
  WHERE session.admin_shift_id = v_shift_id
    AND public.is_pristine_generated_admin_shift_session(session.id)
    AND EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_plan->'occurrences') planned
      WHERE planned->>'action' = 'PRESERVE'
        AND (planned->>'start_at')::TIMESTAMPTZ = session.start_at
        AND (planned->>'end_at')::TIMESTAMPTZ = session.end_at
    )
    AND (
      session.status IS DISTINCT FROM 'ACTIVE'
      OR session.calendar_tombstone_until IS NOT NULL
    );

  FOR v_occurrence IN
    SELECT value
    FROM pg_catalog.jsonb_array_elements(v_plan->'occurrences')
    WHERE value->>'action' = 'CREATE'
  LOOP
    INSERT INTO public.sessions (
      id,
      start_at,
      end_at,
      type,
      admin_shift_id,
      status,
      schedule_origin,
      is_schedule_exception,
      original_start_at,
      original_end_at
    ) VALUES (
      pg_catalog.gen_random_uuid(),
      (v_occurrence->>'start_at')::TIMESTAMPTZ,
      (v_occurrence->>'end_at')::TIMESTAMPTZ,
      'ADMIN_SHIFT',
      v_shift_id,
      'ACTIVE',
      'GENERATED',
      FALSE,
      (v_occurrence->>'start_at')::TIMESTAMPTZ,
      (v_occurrence->>'end_at')::TIMESTAMPTZ
    )
    RETURNING id INTO v_session_id;

    INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
    SELECT
      pg_catalog.gen_random_uuid(),
      v_session_id,
      assignment.staff_id,
      'MAIN_TUTOR',
      v_created_by
    FROM public.admin_shifts_staff assignment
    WHERE assignment.admin_shift_id = v_shift_id
      AND assignment.assigned_at <= (v_occurrence->>'start_at')::TIMESTAMPTZ
      AND (
        assignment.unassigned_at IS NULL
        OR assignment.unassigned_at > (v_occurrence->>'start_at')::TIMESTAMPTZ
      )
    ON CONFLICT (session_id, staff_id) DO NOTHING;
  END LOOP;

  PERFORM public.refresh_admin_shift_schedule_projection(v_shift_id);
  PERFORM pg_catalog.set_config(
    'app.admin_shift_schedule_apply',
    COALESCE(v_previous_shift_apply, ''),
    TRUE
  );
  PERFORM pg_catalog.set_config('app.class_schedule_apply', COALESCE(v_previous_class_apply, ''), TRUE);
  PERFORM pg_catalog.set_config(
    'app.sessions_staff_assignment_source',
    COALESCE(v_previous_assignment_source, ''),
    TRUE
  );
  RETURN v_plan;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config(
    'app.admin_shift_schedule_apply',
    COALESCE(v_previous_shift_apply, ''),
    TRUE
  );
  PERFORM pg_catalog.set_config('app.class_schedule_apply', COALESCE(v_previous_class_apply, ''), TRUE);
  PERFORM pg_catalog.set_config(
    'app.sessions_staff_assignment_source',
    COALESCE(v_previous_assignment_source, ''),
    TRUE
  );
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_admin_shift_schedule(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_admin_shift_schedule(JSONB, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_admin_shift_schedule(JSONB, TEXT) IS
  'Applies a previewed Admin shift timetable from its effective date and leaves earlier Sessions in place.';

CREATE OR REPLACE FUNCTION public.purge_expired_admin_shift_session_tombstones()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND CURRENT_USER <> 'service_role'
     AND NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.sessions session
  WHERE session.type = 'ADMIN_SHIFT'::public.session_type
    AND session.status = 'INACTIVE'
    AND session.calendar_tombstone_until <= pg_catalog.now()
    AND public.is_pristine_generated_admin_shift_session(session.id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_admin_shift_session_tombstones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_admin_shift_session_tombstones()
  TO authenticated, service_role;

UPDATE public.sessions session
SET
  schedule_origin = 'GENERATED',
  original_start_at = session.start_at,
  original_end_at = session.end_at
WHERE session.type = 'ADMIN_SHIFT'::public.session_type
  AND session.schedule_origin = 'LEGACY'
  AND NOT session.is_schedule_exception
  AND session.start_at IS NOT NULL
  AND session.end_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.sessions_students student
    WHERE student.session_id = session.id
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
  AND NOT EXISTS (
    SELECT 1 FROM public.public_link_revocations revocation
    WHERE revocation.session_id = session.id
  );

INSERT INTO public.admin_shift_schedule_revisions (
  admin_shift_id,
  day_of_week,
  start_time,
  end_time,
  status,
  effective_from,
  effective_to,
  created_by
)
SELECT
  shift.id,
  shift.day_of_week::SMALLINT,
  shift.start_time::TIME,
  shift.end_time::TIME,
  shift.status,
  LEAST(bounds.range_start, bounds.range_end),
  GREATEST(bounds.range_start, bounds.range_end),
  shift.created_by
FROM public.admin_shifts shift
CROSS JOIN LATERAL (
  SELECT
    COALESCE(
      shift.session_start_date,
      (shift.created_at AT TIME ZONE 'Australia/Adelaide')::DATE,
      (pg_catalog.now() AT TIME ZONE 'Australia/Adelaide')::DATE
    ) AS range_start,
    GREATEST(
      COALESCE(
        shift.session_end_date,
        (
          pg_catalog.date_trunc(
            'year',
            COALESCE(
              shift.session_start_date,
              (shift.created_at AT TIME ZONE 'Australia/Adelaide')::DATE
            )::TIMESTAMP
          )
          + INTERVAL '1 year'
          - INTERVAL '1 day'
        )::DATE
      ),
      COALESCE(
        (
          SELECT MAX((session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE)
          FROM public.sessions session
          WHERE session.admin_shift_id = shift.id
            AND session.start_at IS NOT NULL
        ),
        COALESCE(
          shift.session_end_date,
          (
            pg_catalog.date_trunc(
              'year',
              COALESCE(
                shift.session_start_date,
                (shift.created_at AT TIME ZONE 'Australia/Adelaide')::DATE
              )::TIMESTAMP
            )
            + INTERVAL '1 year'
            - INTERVAL '1 day'
          )::DATE
        )
      )
    ) AS range_end
) bounds
WHERE shift.start_time::TIME < shift.end_time::TIME;

CREATE VIEW admin_reporting.admin_shift_schedule_revisions
WITH (security_barrier = TRUE) AS
SELECT
  id,
  admin_shift_id,
  day_of_week,
  start_time,
  end_time,
  status,
  effective_from,
  effective_to,
  created_at,
  created_by,
  superseded_at
FROM public.admin_shift_schedule_revisions;

REVOKE ALL ON admin_reporting.admin_shift_schedule_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON admin_reporting.admin_shift_schedule_revisions TO admin_reporting_reader;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available. Skipping weekly-admin-shift-session-creation.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'weekly-admin-shift-session-creation'
  ) THEN
    PERFORM cron.unschedule('weekly-admin-shift-session-creation');
  END IF;

  PERFORM cron.schedule(
    'weekly-admin-shift-session-creation',
    '0 0 * * 0',
    $cron$
    SELECT public.precreate_admin_shift_sessions(
      CURRENT_DATE,
      (CURRENT_DATE + INTERVAL '8 weeks')::DATE,
      NULL,
      NULL
    );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to schedule weekly-admin-shift-session-creation: %', SQLERRM;
END;
$$;
