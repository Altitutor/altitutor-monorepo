-- Migration: Add short_name and long_name to classes and sessions (trigger-updated)
-- Description:
--   Classes: short_name = "{subject.short_name} {day ddd} {start_time h:mm}", long_name = "{subject.long_name} {day dddd} {start h:mm am} - {end h:mm am}"
--   Sessions: short_name = "{subject.short_name} {date ddd D mmm} {start_time h:mm}", long_name = "{subject.long_name} {date dddd Dth mmm yyyy} {start h:mm am} - {end h:mm am}"
--   All times for sessions use Australia/Adelaide. Class times from classes.start_time/end_time (TEXT HH24:MI).

-- ========================
-- CLASSES: ADD COLUMNS
-- ========================

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS long_name TEXT;

COMMENT ON COLUMN public.classes.short_name IS 'Auto-generated: {subject.short_name} {day ddd} {start_time h:mm} e.g. 12MATH mon 4:15';
COMMENT ON COLUMN public.classes.long_name IS 'Auto-generated: {subject.long_name} {day dddd} {start h:mm am} - {end h:mm am} e.g. SACE 12 Mathematical Methods Monday 4:15 pm - 5:45 pm';

-- ========================
-- CLASSES: TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.update_class_names()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_subject_short TEXT;
  v_subject_long TEXT;
  v_day_short TEXT;
  v_day_long TEXT;
  v_start_time TIME;
  v_end_time TIME;
BEGIN
  IF NEW.subject_id IS NULL THEN
    NEW.short_name := NULL;
    NEW.long_name := NULL;
    RETURN NEW;
  END IF;

  SELECT s.short_name, s.long_name INTO v_subject_short, v_subject_long
  FROM public.subjects s
  WHERE s.id = NEW.subject_id;

  v_day_short := CASE NEW.day_of_week
    WHEN 0 THEN 'sun' WHEN 1 THEN 'mon' WHEN 2 THEN 'tue' WHEN 3 THEN 'wed'
    WHEN 4 THEN 'thu' WHEN 5 THEN 'fri' WHEN 6 THEN 'sat'
    ELSE ''
  END;

  v_day_long := CASE NEW.day_of_week
    WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday'
    ELSE ''
  END;

  -- Classes store start_time/end_time as TEXT HH24:MI
  BEGIN
    v_start_time := COALESCE(NEW.start_time, '00:00')::TIME;
  EXCEPTION WHEN OTHERS THEN
    v_start_time := NULL;
  END;
  BEGIN
    v_end_time := COALESCE(NEW.end_time, '00:00')::TIME;
  EXCEPTION WHEN OTHERS THEN
    v_end_time := NULL;
  END;

  -- short_name: subject_short + day ddd + start h:mm (no am/pm)
  NEW.short_name := TRIM(CONCAT(
    COALESCE(v_subject_short, ''),
    CASE WHEN v_subject_short IS NOT NULL AND v_subject_short != '' AND v_day_short != '' THEN ' ' ELSE '' END,
    v_day_short,
    CASE WHEN v_day_short != '' AND v_start_time IS NOT NULL THEN ' ' ELSE '' END,
    CASE WHEN v_start_time IS NOT NULL THEN TO_CHAR(v_start_time, 'FMHH12:MI') ELSE '' END
  ));

  -- long_name: subject_long + day dddd + start h:mm am - end h:mm am
  NEW.long_name := TRIM(CONCAT(
    COALESCE(v_subject_long, ''),
    CASE WHEN v_subject_long IS NOT NULL AND v_subject_long != '' AND v_day_long != '' THEN ' ' ELSE '' END,
    v_day_long,
    CASE WHEN v_day_long != '' AND v_start_time IS NOT NULL THEN ' ' ELSE '' END,
    CASE WHEN v_start_time IS NOT NULL THEN TO_CHAR(v_start_time, 'FMHH12:MI am') ELSE '' END,
    CASE WHEN v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN ' - ' ELSE '' END,
    CASE WHEN v_end_time IS NOT NULL THEN TO_CHAR(v_end_time, 'FMHH12:MI am') ELSE '' END
  ));

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_class_names() IS 'Trigger function that sets classes.short_name and classes.long_name from subject and class time/day';

-- ========================
-- CLASSES: TRIGGER
-- ========================

DROP TRIGGER IF EXISTS trigger_update_class_names ON public.classes;

CREATE TRIGGER trigger_update_class_names
  BEFORE INSERT OR UPDATE OF subject_id, day_of_week, start_time, end_time ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_class_names();

-- ========================
-- SUBJECTS: TRIGGER TO REFRESH CLASS NAMES WHEN SUBJECT NAMES CHANGE
-- ========================

CREATE OR REPLACE FUNCTION public.refresh_class_names_on_subject_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.short_name IS DISTINCT FROM NEW.short_name OR OLD.long_name IS DISTINCT FROM NEW.long_name THEN
    UPDATE public.classes c
    SET
      short_name = TRIM(CONCAT(
        COALESCE(NEW.short_name, ''),
        CASE WHEN NEW.short_name IS NOT NULL AND NEW.short_name != '' THEN ' ' ELSE '' END,
        CASE c.day_of_week
          WHEN 0 THEN 'sun' WHEN 1 THEN 'mon' WHEN 2 THEN 'tue' WHEN 3 THEN 'wed'
          WHEN 4 THEN 'thu' WHEN 5 THEN 'fri' WHEN 6 THEN 'sat' ELSE ''
        END,
        CASE WHEN c.start_time IS NOT NULL THEN ' ' || TO_CHAR(COALESCE(c.start_time, '00:00')::TIME, 'FMHH12:MI') ELSE '' END
      )),
      long_name = TRIM(CONCAT(
        COALESCE(NEW.long_name, ''),
        CASE WHEN NEW.long_name IS NOT NULL AND NEW.long_name != '' THEN ' ' ELSE '' END,
        CASE c.day_of_week
          WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday' ELSE ''
        END,
        CASE WHEN c.start_time IS NOT NULL THEN ' ' || TO_CHAR(COALESCE(c.start_time, '00:00')::TIME, 'FMHH12:MI am') ELSE '' END,
        CASE WHEN c.start_time IS NOT NULL AND c.end_time IS NOT NULL THEN ' - ' || TO_CHAR(COALESCE(c.end_time, '00:00')::TIME, 'FMHH12:MI am') ELSE '' END
      ))
    WHERE c.subject_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_refresh_class_names_on_subject_update ON public.subjects;

CREATE TRIGGER trigger_refresh_class_names_on_subject_update
  AFTER UPDATE OF short_name, long_name ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_class_names_on_subject_update();

-- ========================
-- SESSIONS: ADD COLUMNS
-- ========================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS long_name TEXT;

COMMENT ON COLUMN public.sessions.short_name IS 'Auto-generated: {subject.short_name} {date ddd D mmm} {start h:mm} e.g. 12MATH mon 5 dec 4:15';
COMMENT ON COLUMN public.sessions.long_name IS 'Auto-generated: {subject.long_name} {date dddd Dth mmm yyyy} {start h:mm am} - {end h:mm am}';

-- ========================
-- SESSIONS: HELPER FOR ORDINAL DATE
-- ========================

CREATE OR REPLACE FUNCTION public._format_date_ordinal(ts timestamptz)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d INTEGER;
  suffix TEXT;
  adelaide_ts TIMESTAMP;
BEGIN
  adelaide_ts := ts AT TIME ZONE 'Australia/Adelaide';
  d := EXTRACT(DAY FROM adelaide_ts)::INTEGER;
  suffix := CASE
    WHEN d IN (1, 21, 31) THEN 'st'
    WHEN d IN (2, 22) THEN 'nd'
    WHEN d IN (3, 23) THEN 'rd'
    ELSE 'th'
  END;
  RETURN TO_CHAR(adelaide_ts, 'FMDay') || ' ' || d::TEXT || suffix || ' ' || TO_CHAR(adelaide_ts, 'FMMonth YYYY');
END;
$$;

-- ========================
-- SESSIONS: TRIGGER FUNCTION
-- ========================

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
BEGIN
  IF NEW.subject_id IS NULL OR NEW.start_at IS NULL THEN
    NEW.short_name := NULL;
    NEW.long_name := NULL;
    RETURN NEW;
  END IF;

  SELECT s.short_name, s.long_name INTO v_subject_short, v_subject_long
  FROM public.subjects s
  WHERE s.id = NEW.subject_id;

  v_start_adelaide := NEW.start_at AT TIME ZONE 'Australia/Adelaide';
  v_end_adelaide := COALESCE(NEW.end_at, NEW.start_at) AT TIME ZONE 'Australia/Adelaide';

  -- short date: "mon 5 dec" (ddd D mmm)
  v_date_short := LOWER(TO_CHAR(v_start_adelaide, 'Dy')) || ' ' ||
    TO_CHAR(v_start_adelaide, 'FMDD') || ' ' ||
    LOWER(TO_CHAR(v_start_adelaide, 'Mon'));

  -- long date: "Monday 5th December 2026"
  v_date_long := public._format_date_ordinal(NEW.start_at);

  -- short_name: subject_short + date ddd D mmm + start h:mm (no am/pm)
  NEW.short_name := TRIM(CONCAT(
    COALESCE(v_subject_short, ''),
    CASE WHEN v_subject_short IS NOT NULL AND v_subject_short != '' AND v_date_short != '' THEN ' ' ELSE '' END,
    v_date_short,
    CASE WHEN v_date_short != '' THEN ' ' ELSE '' END,
    TO_CHAR(v_start_adelaide, 'FMHH12:MI')
  ));

  -- long_name: subject_long + date dddd Dth mmm yyyy + start h:mm am - end h:mm am
  NEW.long_name := TRIM(CONCAT(
    COALESCE(v_subject_long, ''),
    CASE WHEN v_subject_long IS NOT NULL AND v_subject_long != '' THEN ' ' ELSE '' END,
    v_date_long,
    ' ',
    TO_CHAR(v_start_adelaide, 'FMHH12:MI am'),
    ' - ',
    TO_CHAR(v_end_adelaide, 'FMHH12:MI am')
  ));

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_session_names() IS 'Trigger function that sets sessions.short_name and sessions.long_name from subject and session start_at/end_at (Adelaide)';

-- ========================
-- SESSIONS: TRIGGER
-- ========================

DROP TRIGGER IF EXISTS trigger_update_session_names ON public.sessions;

CREATE TRIGGER trigger_update_session_names
  BEFORE INSERT OR UPDATE OF subject_id, start_at, end_at ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_session_names();

-- ========================
-- REFRESH SESSION NAMES WHEN SUBJECT NAMES CHANGE
-- ========================

CREATE OR REPLACE FUNCTION public.refresh_session_names_on_subject_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.short_name IS DISTINCT FROM NEW.short_name OR OLD.long_name IS DISTINCT FROM NEW.long_name THEN
    UPDATE public.sessions s
    SET
      short_name = TRIM(CONCAT(
        COALESCE(NEW.short_name, ''),
        CASE WHEN NEW.short_name IS NOT NULL AND NEW.short_name != '' THEN ' ' ELSE '' END,
        LOWER(TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Dy')) || ' ' ||
          TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMDD') || ' ' ||
          LOWER(TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Mon')),
        ' ',
        TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI')
      )),
      long_name = TRIM(CONCAT(
        COALESCE(NEW.long_name, ''),
        ' ',
        public._format_date_ordinal(s.start_at),
        ' ',
        TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI am'),
        ' - ',
        TO_CHAR(COALESCE(s.end_at, s.start_at) AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI am')
      ))
    WHERE s.subject_id = NEW.id
      AND s.start_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_refresh_session_names_on_subject_update ON public.subjects;

CREATE TRIGGER trigger_refresh_session_names_on_subject_update
  AFTER UPDATE OF short_name, long_name ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_session_names_on_subject_update();

-- ========================
-- BACKFILL CLASSES
-- ========================

UPDATE public.classes c
SET
  short_name = TRIM(CONCAT(
    COALESCE(s.short_name, ''),
    CASE WHEN s.short_name IS NOT NULL AND s.short_name != '' THEN ' ' ELSE '' END,
    CASE c.day_of_week
      WHEN 0 THEN 'sun' WHEN 1 THEN 'mon' WHEN 2 THEN 'tue' WHEN 3 THEN 'wed'
      WHEN 4 THEN 'thu' WHEN 5 THEN 'fri' WHEN 6 THEN 'sat' ELSE ''
    END,
    CASE WHEN c.start_time IS NOT NULL THEN ' ' || TO_CHAR(COALESCE(c.start_time, '00:00')::TIME, 'FMHH12:MI') ELSE '' END
  )),
  long_name = TRIM(CONCAT(
    COALESCE(s.long_name, ''),
    CASE WHEN s.long_name IS NOT NULL AND s.long_name != '' THEN ' ' ELSE '' END,
    CASE c.day_of_week
      WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday' WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday' ELSE ''
    END,
    CASE WHEN c.start_time IS NOT NULL THEN ' ' || TO_CHAR(COALESCE(c.start_time, '00:00')::TIME, 'FMHH12:MI am') ELSE '' END,
    CASE WHEN c.start_time IS NOT NULL AND c.end_time IS NOT NULL THEN ' - ' || TO_CHAR(COALESCE(c.end_time, '00:00')::TIME, 'FMHH12:MI am') ELSE '' END
  ))
FROM public.subjects s
WHERE c.subject_id = s.id;

-- ========================
-- BACKFILL SESSIONS
-- ========================

UPDATE public.sessions s
SET
  short_name = TRIM(CONCAT(
    COALESCE(sub.short_name, ''),
    CASE WHEN sub.short_name IS NOT NULL AND sub.short_name != '' THEN ' ' ELSE '' END,
    LOWER(TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Dy')) || ' ' ||
      TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMDD') || ' ' ||
      LOWER(TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Mon')),
    ' ',
    TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI')
  )),
  long_name = TRIM(CONCAT(
    COALESCE(sub.long_name, ''),
    ' ',
    public._format_date_ordinal(s.start_at),
    ' ',
    TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI am'),
    ' - ',
    TO_CHAR(COALESCE(s.end_at, s.start_at) AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI am')
  ))
FROM public.subjects sub
WHERE s.subject_id = sub.id
  AND s.start_at IS NOT NULL;
