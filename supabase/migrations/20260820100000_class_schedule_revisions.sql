-- Model a Class independently from the bounded timetable that materializes its Sessions.

CREATE TABLE public.class_schedule_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('RECURRING', 'CUSTOM')),
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  frequency_weeks SMALLINT,
  anchor_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  CHECK (effective_from <= effective_to),
  CHECK (
    (schedule_type = 'RECURRING' AND frequency_weeks IN (1, 2) AND anchor_date IS NOT NULL)
    OR
    (schedule_type = 'CUSTOM' AND frequency_weeks IS NULL AND anchor_date IS NULL)
  )
);

CREATE INDEX class_schedule_revisions_class_effective_idx
  ON public.class_schedule_revisions (class_id, effective_from, effective_to);

ALTER TABLE public.class_schedule_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to class schedule revisions"
  ON public.class_schedule_revisions
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedule_revisions TO authenticated;

COMMENT ON TABLE public.class_schedule_revisions IS
  'Effective-dated recurring or custom timetable definitions for a Class.';

CREATE TABLE public.class_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_revision_id UUID NOT NULL
    REFERENCES public.class_schedule_revisions(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  position SMALLINT NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time),
  UNIQUE (schedule_revision_id, day_of_week, start_time, end_time)
);

CREATE INDEX class_schedule_slots_revision_position_idx
  ON public.class_schedule_slots (schedule_revision_id, position);

ALTER TABLE public.class_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to class schedule slots"
  ON public.class_schedule_slots
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_schedule_slots TO authenticated;

COMMENT ON TABLE public.class_schedule_slots IS
  'One weekday, local time range, and room row in a recurring Class schedule revision.';

CREATE OR REPLACE FUNCTION public.preview_class_schedule(p_proposal JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_schedule_type TEXT := p_proposal->>'schedule_type';
  v_start_date DATE := (p_proposal->>'start_date')::DATE;
  v_end_date DATE := (p_proposal->>'end_date')::DATE;
  v_effective_from DATE := COALESCE((p_proposal->>'effective_from')::DATE, v_start_date);
  v_timezone TEXT := COALESCE(NULLIF(p_proposal->>'timezone', ''), 'Australia/Adelaide');
  v_frequency_weeks SMALLINT := NULLIF(p_proposal->>'frequency_weeks', '')::SMALLINT;
  v_anchor_date DATE := NULLIF(p_proposal->>'anchor_date', '')::DATE;
  v_date DATE;
  v_row JSONB;
  v_other_row JSONB;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_occurrences JSONB := '[]'::JSONB;
  v_reconciled_occurrences JSONB := '[]'::JSONB;
  v_removals JSONB := '[]'::JSONB;
  v_occurrence_count INTEGER := 0;
  v_create_count INTEGER := 0;
  v_preserve_count INTEGER := 0;
  v_cancel_count INTEGER := 0;
  v_protected_count INTEGER := 0;
  v_class_id UUID := NULLIF(p_proposal->>'class_id', '')::UUID;
  v_session RECORD;
BEGIN
  IF CURRENT_USER NOT IN ('postgres', 'service_role')
     AND NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE = '42501';
  END IF;

  IF v_start_date IS NULL OR v_end_date IS NULL OR v_start_date > v_end_date THEN
    RAISE EXCEPTION 'A valid Class start and end date are required';
  END IF;

  IF v_effective_from < v_start_date OR v_effective_from > v_end_date THEN
    RAISE EXCEPTION 'The schedule effective date must fall within the Class bounds';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone) THEN
    RAISE EXCEPTION 'Unknown Class schedule timezone: %', v_timezone;
  END IF;

  IF v_schedule_type = 'RECURRING' THEN
    IF v_frequency_weeks NOT IN (1, 2) OR v_anchor_date IS NULL THEN
      RAISE EXCEPTION 'Recurring schedules require a weekly or fortnightly anchor';
    END IF;

    IF jsonb_array_length(COALESCE(p_proposal->'recurring_rows', '[]'::JSONB)) = 0 THEN
      RAISE EXCEPTION 'A recurring schedule requires at least one row';
    END IF;

    FOR v_row IN
      SELECT value FROM jsonb_array_elements(p_proposal->'recurring_rows')
    LOOP
      IF (v_row->>'day_of_week')::INTEGER NOT BETWEEN 0 AND 6
         OR (v_row->>'start_time')::TIME >= (v_row->>'end_time')::TIME THEN
        RAISE EXCEPTION 'Each recurring row requires a valid weekday and time range';
      END IF;

      FOR v_other_row IN
        SELECT value FROM jsonb_array_elements(p_proposal->'recurring_rows')
        WHERE value::TEXT > v_row::TEXT
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

    FOR v_row IN
      SELECT value FROM jsonb_array_elements(p_proposal->'custom_sessions')
    LOOP
      v_date := (v_row->>'date')::DATE;
      IF v_date < v_effective_from OR v_date > v_end_date
         OR (v_row->>'start_time')::TIME >= (v_row->>'end_time')::TIME THEN
        RAISE EXCEPTION 'Each custom Session must fall within the Class bounds with a valid time range';
      END IF;
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
    RAISE EXCEPTION 'A Class timetable cannot contain more than 1000 Sessions';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_occurrences)
  LOOP
    IF v_class_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.class_id = v_class_id
        AND s.start_at = (v_row->>'start_at')::TIMESTAMPTZ
        AND s.end_at = (v_row->>'end_at')::TIMESTAMPTZ
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
      SELECT s.id, s.start_at, s.end_at, s.is_schedule_exception
      FROM public.sessions s
      WHERE s.class_id = v_class_id
        AND s.type = 'CLASS'
        AND s.status = 'ACTIVE'
        AND s.start_at >= v_effective_from::TIMESTAMP AT TIME ZONE v_timezone
        AND (s.start_at AT TIME ZONE v_timezone)::DATE <= v_end_date
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(v_occurrences) planned
          WHERE (planned->>'start_at')::TIMESTAMPTZ = s.start_at
            AND (planned->>'end_at')::TIMESTAMPTZ = s.end_at
        )
      ORDER BY s.start_at, s.id
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

  RETURN jsonb_build_object(
    'proposal_hash', encode(extensions.digest(p_proposal::TEXT, 'sha256'), 'hex'),
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
    'conflicts', '[]'::JSONB
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_class_schedule(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_class_schedule(JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.preview_class_schedule(JSONB) IS
  'Validates a proposed Class schedule and returns its concrete Session plan without writing data.';

-- Retire the scalar Class triggers before changing legacy scheduling fields. The planner is the
-- only writer of recurring Class Sessions after this migration.
DROP TRIGGER IF EXISTS trigger_create_sessions_on_class_insert ON public.classes;
DROP TRIGGER IF EXISTS trigger_sync_sessions_on_class_date_update ON public.classes;
DROP TRIGGER IF EXISTS trigger_sync_sessions_on_class_update ON public.classes;
DROP TRIGGER IF EXISTS trigger_delete_future_sessions_on_class_delete ON public.classes;

ALTER TABLE public.classes
  ADD COLUMN cohort_label TEXT,
  ADD COLUMN schedule_timezone TEXT NOT NULL DEFAULT 'Australia/Adelaide',
  ADD COLUMN schedule_summary_short TEXT,
  ADD COLUMN schedule_summary_long TEXT,
  ADD COLUMN schedule_weekdays SMALLINT[] NOT NULL DEFAULT '{}',
  ADD COLUMN next_session_start_at TIMESTAMPTZ;

UPDATE public.classes
SET
  cohort_label = NULLIF(BTRIM(level), ''),
  session_start_date = DATE '2026-01-01',
  session_end_date = DATE '2026-12-31',
  status = CASE WHEN status = 'FULL' THEN 'ACTIVE' ELSE status END;

ALTER TABLE public.classes
  ALTER COLUMN session_start_date SET NOT NULL,
  ALTER COLUMN session_end_date SET NOT NULL,
  DROP CONSTRAINT classes_status_check,
  ADD CONSTRAINT classes_status_check CHECK (status IN ('ACTIVE', 'INACTIVE')),
  ADD CONSTRAINT classes_schedule_bounds_check CHECK (session_start_date <= session_end_date);

DROP TRIGGER IF EXISTS trigger_update_class_names ON public.classes;
DROP TRIGGER IF EXISTS trigger_refresh_class_names_on_subject_update ON public.subjects;

ALTER TABLE public.sessions
  ADD COLUMN schedule_revision_id UUID REFERENCES public.class_schedule_revisions(id) ON DELETE SET NULL,
  ADD COLUMN schedule_slot_id UUID REFERENCES public.class_schedule_slots(id) ON DELETE SET NULL,
  ADD COLUMN schedule_origin TEXT NOT NULL DEFAULT 'LEGACY'
    CHECK (schedule_origin IN ('GENERATED', 'CUSTOM', 'EXCEPTION', 'LEGACY')),
  ADD COLUMN is_schedule_exception BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN original_start_at TIMESTAMPTZ,
  ADD COLUMN original_end_at TIMESTAMPTZ,
  ADD COLUMN room TEXT,
  ADD COLUMN calendar_tombstone_until TIMESTAMPTZ;

CREATE INDEX sessions_schedule_revision_start_idx
  ON public.sessions (schedule_revision_id, start_at)
  WHERE schedule_revision_id IS NOT NULL;

CREATE INDEX sessions_schedule_slot_start_idx
  ON public.sessions (schedule_slot_id, start_at)
  WHERE schedule_slot_id IS NOT NULL;

CREATE INDEX sessions_calendar_tombstone_idx
  ON public.sessions (calendar_tombstone_until)
  WHERE calendar_tombstone_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_pristine_generated_class_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = p_session_id
      AND s.type = 'CLASS'
      AND s.schedule_origin IN ('GENERATED', 'CUSTOM')
      AND NOT s.is_schedule_exception
      AND s.original_start_at = s.start_at
      AND s.original_end_at = s.end_at
      AND NOT EXISTS (
        SELECT 1
        FROM public.sessions_students ss
        WHERE ss.session_id = s.id
          AND (ss.planned_absence OR ss.is_rescheduled OR ss.is_credited OR ss.was_trial)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.sessions_staff ss
        WHERE ss.session_id = s.id
          AND (ss.planned_absence OR ss.is_swapped OR ss.was_trial)
      )
      AND NOT EXISTS (SELECT 1 FROM public.tutor_logs tl WHERE tl.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.sessions_files sf WHERE sf.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.ucat_sessions_resources usr WHERE usr.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.invoice_items ii WHERE ii.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.form_responses fr WHERE fr.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.sessions_parents sp WHERE sp.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.public_link_revocations plr WHERE plr.session_id = s.id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_pristine_generated_class_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pristine_generated_class_session(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_pristine_generated_class_session(UUID) IS
  'Returns whether a generated Class Session has no exception or independently authored operational data.';

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
  v_subject_short TEXT;
  v_subject_long TEXT;
  v_identity_short TEXT;
  v_identity_long TEXT;
  v_today DATE;
BEGIN
  SELECT c.*, s.short_name AS subject_short, s.long_name AS subject_long, s.name AS subject_name
  INTO v_class
  FROM public.classes c
  LEFT JOIN public.subjects s ON s.id = c.subject_id
  WHERE c.id = p_class_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_today := (NOW() AT TIME ZONE v_class.schedule_timezone)::DATE;
  v_subject_short := COALESCE(NULLIF(BTRIM(v_class.subject_short), ''), NULLIF(BTRIM(v_class.subject_name), ''), 'Class');
  v_subject_long := COALESCE(NULLIF(BTRIM(v_class.subject_long), ''), NULLIF(BTRIM(v_class.subject_name), ''), v_subject_short);
  v_identity_short := CONCAT_WS(' ', v_subject_short, NULLIF(BTRIM(v_class.cohort_label), ''));
  v_identity_long := CONCAT_WS(' ', v_subject_long, NULLIF(BTRIM(v_class.cohort_label), ''));

  SELECT csr.*
  INTO v_revision
  FROM public.class_schedule_revisions csr
  WHERE csr.class_id = p_class_id
    AND csr.effective_to >= v_today
  ORDER BY
    (v_today BETWEEN csr.effective_from AND csr.effective_to) DESC,
    CASE WHEN csr.effective_from > v_today THEN csr.effective_from END ASC NULLS LAST,
    csr.effective_from DESC,
    csr.created_at DESC
  LIMIT 1;

  IF FOUND AND v_revision.schedule_type = 'RECURRING' THEN
    SELECT
      string_agg(
        CASE css.day_of_week
          WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue' WHEN 3 THEN 'Wed'
          WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat'
        END || ' ' || TO_CHAR(css.start_time, 'FMHH12:MI'),
        ', ' ORDER BY css.position, css.day_of_week, css.start_time
      ),
      string_agg(
        CASE css.day_of_week
          WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday'
        END || ' ' || TO_CHAR(css.start_time, 'FMHH12:MI am') || '–' || TO_CHAR(css.end_time, 'FMHH12:MI am'),
        ', ' ORDER BY css.position, css.day_of_week, css.start_time
      )
    INTO v_summary_short, v_summary_long
    FROM public.class_schedule_slots css
    WHERE css.schedule_revision_id = v_revision.id;

    SELECT COALESCE(array_agg(days.day_of_week ORDER BY days.day_of_week), '{}'::SMALLINT[])
    INTO v_weekdays
    FROM (
      SELECT DISTINCT css.day_of_week
      FROM public.class_schedule_slots css
      WHERE css.schedule_revision_id = v_revision.id
    ) days;

    IF v_revision.frequency_weeks = 2 THEN
      v_summary_short := CONCAT(v_summary_short, ' · fortnightly');
      v_summary_long := CONCAT(v_summary_long, ', fortnightly');
    END IF;
  ELSIF FOUND AND v_revision.schedule_type = 'CUSTOM' THEN
    SELECT
      COUNT(*)::TEXT || ' sessions',
      COUNT(*)::TEXT || ' sessions, ' ||
        TO_CHAR(MIN(s.start_at AT TIME ZONE v_class.schedule_timezone), 'FMMon DD') || '–' ||
        TO_CHAR(MAX(s.start_at AT TIME ZONE v_class.schedule_timezone), 'FMMon DD, YYYY')
    INTO v_summary_short, v_summary_long
    FROM public.sessions s
    WHERE s.class_id = p_class_id
      AND s.schedule_revision_id = v_revision.id
      AND s.status = 'ACTIVE';
  END IF;

  UPDATE public.classes c
  SET
    schedule_summary_short = NULLIF(v_summary_short, ''),
    schedule_summary_long = NULLIF(v_summary_long, ''),
    schedule_weekdays = v_weekdays,
    short_name = CONCAT(v_identity_short, CASE WHEN v_summary_short IS NOT NULL THEN ' · ' || v_summary_short ELSE '' END),
    long_name = CONCAT(v_identity_long, CASE WHEN v_summary_long IS NOT NULL THEN ' · ' || v_summary_long ELSE '' END),
    next_session_start_at = (
      SELECT MIN(s.start_at)
      FROM public.sessions s
      WHERE s.class_id = p_class_id
        AND s.status = 'ACTIVE'
        AND s.start_at >= NOW()
    )
  WHERE c.id = p_class_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_class_schedule_projection(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_class_schedule_projection(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_class_schedule_projection_on_subject_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_class_id UUID;
BEGIN
  IF OLD.short_name IS DISTINCT FROM NEW.short_name OR OLD.long_name IS DISTINCT FROM NEW.long_name THEN
    FOR v_class_id IN SELECT c.id FROM public.classes c WHERE c.subject_id = NEW.id
    LOOP
      PERFORM public.refresh_class_schedule_projection(v_class_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_refresh_class_schedule_projection_on_subject_update
  AFTER UPDATE OF short_name, long_name ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_class_schedule_projection_on_subject_update();

-- Production-safe additive backfill. It describes the 2026 pattern and never inserts, moves,
-- removes, or inactivates an existing Session.
INSERT INTO public.class_schedule_revisions (
  id,
  class_id,
  schedule_type,
  effective_from,
  effective_to,
  frequency_weeks,
  anchor_date,
  created_by
)
SELECT
  gen_random_uuid(),
  c.id,
  'RECURRING',
  DATE '2026-01-01',
  DATE '2026-12-31',
  1,
  DATE '2026-01-01',
  c.created_by
FROM public.classes c;

INSERT INTO public.class_schedule_slots (
  id,
  schedule_revision_id,
  day_of_week,
  start_time,
  end_time,
  room,
  position
)
SELECT
  gen_random_uuid(),
  csr.id,
  c.day_of_week,
  c.start_time::TIME,
  c.end_time::TIME,
  c.room,
  0
FROM public.class_schedule_revisions csr
JOIN public.classes c ON c.id = csr.class_id
WHERE c.day_of_week IS NOT NULL
  AND c.start_time IS NOT NULL
  AND c.end_time IS NOT NULL;

UPDATE public.sessions s
SET
  schedule_revision_id = csr.id,
  schedule_slot_id = css.id,
  schedule_origin = 'GENERATED',
  original_start_at = s.start_at,
  original_end_at = s.end_at,
  room = css.room
FROM public.class_schedule_revisions csr
JOIN public.class_schedule_slots css ON css.schedule_revision_id = csr.id
WHERE s.class_id = csr.class_id
  AND s.type = 'CLASS'
  AND (s.start_at AT TIME ZONE 'Australia/Adelaide')::DATE
      BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
  AND EXTRACT(DOW FROM s.start_at AT TIME ZONE 'Australia/Adelaide')::INTEGER = css.day_of_week
  AND (s.start_at AT TIME ZONE 'Australia/Adelaide')::TIME = css.start_time
  AND (s.end_at AT TIME ZONE 'Australia/Adelaide')::TIME = css.end_time;

UPDATE public.sessions s
SET
  schedule_origin = 'EXCEPTION',
  is_schedule_exception = TRUE,
  original_start_at = s.start_at,
  original_end_at = s.end_at
WHERE s.class_id IS NOT NULL
  AND s.type = 'CLASS'
  AND (s.start_at AT TIME ZONE 'Australia/Adelaide')::DATE
      BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
  AND s.schedule_revision_id IS NULL;

DO $$
DECLARE
  v_class_id UUID;
BEGIN
  FOR v_class_id IN SELECT id FROM public.classes
  LOOP
    PERFORM public.refresh_class_schedule_projection(v_class_id);
  END LOOP;
END;
$$;

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
  v_plan JSONB;
  v_class_id UUID := (p_proposal->>'class_id')::UUID;
  v_revision_id UUID := gen_random_uuid();
  v_subject_id UUID := NULLIF(p_proposal->>'subject_id', '')::UUID;
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
  v_primary_day SMALLINT;
  v_primary_start TIME;
  v_primary_end TIME;
  v_primary_room TEXT;
  v_class_status TEXT := COALESCE(NULLIF(p_proposal->>'status', ''), 'ACTIVE');
BEGIN
  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'A client-generated Class id is required';
  END IF;

  v_plan := public.preview_class_schedule(p_proposal);
  IF v_plan->>'proposal_hash' IS DISTINCT FROM p_expected_proposal_hash THEN
    RAISE EXCEPTION 'The Class schedule changed after preview; preview it again';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_class_id::TEXT, 0));

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

  IF EXISTS (SELECT 1 FROM public.classes WHERE id = v_class_id) THEN
    UPDATE public.classes
    SET
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
    SET effective_to = v_effective_from - 1
    WHERE class_id = v_class_id
      AND effective_from < v_effective_from
      AND effective_to >= v_effective_from;
  ELSE
    INSERT INTO public.classes (
      id,
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
    schedule_type,
    effective_from,
    effective_to,
    frequency_weeks,
    anchor_date,
    created_by
  ) VALUES (
    v_revision_id,
    v_class_id,
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

  -- Existing exact occurrences keep their stable Session identity. Removed generated Sessions
  -- become hidden calendar tombstones; explicit exceptions remain active.
  UPDATE public.sessions s
  SET
    status = 'INACTIVE',
    calendar_tombstone_until = NOW() + INTERVAL '90 days'
  WHERE s.class_id = v_class_id
    AND s.type = 'CLASS'
    AND s.start_at >= v_effective_from::TIMESTAMP AT TIME ZONE v_timezone
    AND public.is_pristine_generated_class_session(s.id)
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_plan->'occurrences') planned
      WHERE (planned->>'start_at')::TIMESTAMPTZ = s.start_at
        AND (planned->>'end_at')::TIMESTAMPTZ = s.end_at
    );

  FOR v_occurrence IN
    SELECT value FROM jsonb_array_elements(v_plan->'occurrences')
  LOOP
    v_slot_id := NULL;
    IF v_schedule_type = 'RECURRING' THEN
      SELECT css.id
      INTO v_slot_id
      FROM public.class_schedule_slots css
      WHERE css.schedule_revision_id = v_revision_id
        AND css.day_of_week = EXTRACT(
          DOW FROM (v_occurrence->>'start_at')::TIMESTAMPTZ AT TIME ZONE v_timezone
        )::SMALLINT
        AND css.start_time = (
          (v_occurrence->>'start_at')::TIMESTAMPTZ AT TIME ZONE v_timezone
        )::TIME
        AND css.end_time = (
          (v_occurrence->>'end_at')::TIMESTAMPTZ AT TIME ZONE v_timezone
        )::TIME
      ORDER BY css.position, css.id
      LIMIT 1;
    END IF;

    SELECT s.id INTO v_session_id
    FROM public.sessions s
    WHERE s.class_id = v_class_id
      AND s.start_at = (v_occurrence->>'start_at')::TIMESTAMPTZ
      AND s.end_at = (v_occurrence->>'end_at')::TIMESTAMPTZ
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
        'CLASS',
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

    INSERT INTO public.sessions_students (id, session_id, student_id, created_by)
    SELECT gen_random_uuid(), v_session_id, cs.student_id, v_created_by
    FROM public.classes_students cs
    WHERE cs.class_id = v_class_id
      AND cs.enrolled_at <= (v_occurrence->>'start_at')::TIMESTAMPTZ
      AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > (v_occurrence->>'start_at')::TIMESTAMPTZ)
    ON CONFLICT (session_id, student_id) DO NOTHING;

    PERFORM set_config('app.sessions_staff_assignment_source', 'class_staff_sync', TRUE);
    INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
    SELECT gen_random_uuid(), v_session_id, cst.staff_id, 'MAIN_TUTOR', v_created_by
    FROM public.classes_staff cst
    WHERE cst.class_id = v_class_id
      AND cst.assigned_at <= (v_occurrence->>'start_at')::TIMESTAMPTZ
      AND (cst.unassigned_at IS NULL OR cst.unassigned_at > (v_occurrence->>'start_at')::TIMESTAMPTZ)
    ON CONFLICT (session_id, staff_id) DO NOTHING;
    PERFORM set_config(
      'app.sessions_staff_assignment_source',
      COALESCE(v_previous_assignment_source, ''),
      TRUE
    );
  END LOOP;

  PERFORM public.refresh_class_schedule_projection(v_class_id);

  RETURN v_plan || jsonb_build_object('class_id', v_class_id, 'schedule_revision_id', v_revision_id);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config(
    'app.sessions_staff_assignment_source',
    COALESCE(v_previous_assignment_source, ''),
    TRUE
  );
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_class_schedule(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_class_schedule(JSONB, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_class_schedule(JSONB, TEXT) IS
  'Applies an unchanged previewed Class schedule proposal and materializes its concrete Sessions atomically.';
