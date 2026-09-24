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
  v_occurrence_count INTEGER := 0;
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

  RETURN jsonb_build_object(
    'proposal_hash', encode(extensions.digest(p_proposal::TEXT, 'sha256'), 'hex'),
    'counts', jsonb_build_object(
      'create', v_occurrence_count,
      'update', 0,
      'delete', 0,
      'cancel', 0,
      'preserve', 0
    ),
    'occurrences', v_occurrences,
    'conflicts', '[]'::JSONB
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_class_schedule(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_class_schedule(JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.preview_class_schedule(JSONB) IS
  'Validates a proposed Class schedule and returns its concrete Session plan without writing data.';
