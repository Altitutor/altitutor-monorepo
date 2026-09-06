-- Homework Help sessions and offerings use a fixed display name instead of
-- cohort labels or type-derived session names (e.g. "HOMEWORK sun 6 sep 1:15").

CREATE OR REPLACE FUNCTION public.update_session_names()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_subject_short TEXT;
  v_subject_long TEXT;
  v_start_adelaide TIMESTAMP;
  v_end_adelaide TIMESTAMP;
  v_date_short TEXT;
  v_date_long TEXT;
  v_type_short TEXT;
  v_type_long TEXT;
BEGIN
  IF NEW.start_at IS NULL THEN
    NEW.short_name := NULL;
    NEW.long_name := NULL;
    RETURN NEW;
  END IF;

  IF NEW.type = 'HOMEWORK_HELP'::public.session_type THEN
    NEW.short_name := 'Homework help';
    NEW.long_name := 'Homework help';
    RETURN NEW;
  END IF;

  v_start_adelaide := NEW.start_at AT TIME ZONE 'Australia/Adelaide';
  v_end_adelaide := COALESCE(NEW.end_at, NEW.start_at) AT TIME ZONE 'Australia/Adelaide';

  v_date_short := LOWER(TO_CHAR(v_start_adelaide, 'Dy')) || ' ' ||
    TO_CHAR(v_start_adelaide, 'FMDD') || ' ' ||
    LOWER(TO_CHAR(v_start_adelaide, 'Mon'));

  v_date_long := public._format_date_ordinal(NEW.start_at);

  IF NEW.type IS DISTINCT FROM 'CLASS' THEN
    v_type_short := COALESCE(NULLIF(split_part(NEW.type::text, '_', 1), ''), NEW.type::text);
    v_type_long := REPLACE(NEW.type::text, '_', ' ');

    NEW.short_name := TRIM(CONCAT(
      COALESCE(v_type_short, ''),
      CASE WHEN v_type_short IS NOT NULL AND v_type_short != '' AND v_date_short != '' THEN ' ' ELSE '' END,
      v_date_short,
      CASE WHEN v_date_short != '' THEN ' ' ELSE '' END,
      TO_CHAR(v_start_adelaide, 'FMHH12:MI')
    ));

    NEW.long_name := TRIM(CONCAT(
      COALESCE(v_type_long, ''),
      CASE WHEN v_type_long IS NOT NULL AND v_type_long != '' THEN ' ' ELSE '' END,
      v_date_long,
      ' ',
      TO_CHAR(v_start_adelaide, 'FMHH12:MI am'),
      ' - ',
      TO_CHAR(v_end_adelaide, 'FMHH12:MI am')
    ));
  ELSE
    IF NEW.subject_id IS NULL THEN
      NEW.short_name := NULL;
      NEW.long_name := NULL;
      RETURN NEW;
    END IF;

    SELECT s.short_name, s.long_name INTO v_subject_short, v_subject_long
    FROM public.subjects s
    WHERE s.id = NEW.subject_id;

    NEW.short_name := TRIM(CONCAT(
      COALESCE(v_subject_short, ''),
      CASE WHEN v_subject_short IS NOT NULL AND v_subject_short != '' AND v_date_short != '' THEN ' ' ELSE '' END,
      v_date_short,
      CASE WHEN v_date_short != '' THEN ' ' ELSE '' END,
      TO_CHAR(v_start_adelaide, 'FMHH12:MI')
    ));

    NEW.long_name := TRIM(CONCAT(
      COALESCE(v_subject_long, ''),
      CASE WHEN v_subject_long IS NOT NULL AND v_subject_long != '' THEN ' ' ELSE '' END,
      v_date_long,
      ' ',
      TO_CHAR(v_start_adelaide, 'FMHH12:MI am'),
      ' - ',
      TO_CHAR(v_end_adelaide, 'FMHH12:MI am')
    ));
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_session_names() IS
  'Sets sessions.short_name and sessions.long_name. Homework Help uses a fixed label; CLASS sessions use subject names; other types use session type (Adelaide timezone).';

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

UPDATE public.sessions
SET
  short_name = 'Homework help',
  long_name = 'Homework help'
WHERE type = 'HOMEWORK_HELP'::public.session_type;

DO $$
DECLARE
  v_class_id UUID;
BEGIN
  FOR v_class_id IN
    SELECT class.id
    FROM public.classes class
    WHERE class.session_type = 'HOMEWORK_HELP'::public.session_type
  LOOP
    PERFORM public.refresh_class_schedule_projection(v_class_id);
  END LOOP;
END;
$$;
