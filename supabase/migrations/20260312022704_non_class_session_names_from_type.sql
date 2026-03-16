-- Migration: Non-class session names from type
-- Description:
--   For sessions where type != 'CLASS', generate short_name and long_name
--   from sessions.type (e.g. TRIAL_SESSION, SUBSIDY_INTERVIEW) instead of
--   subject.short_name/long_name.
--   Format:
--     short_name: "{type before first underscore} {date ddd D mmm} {start h:mm}"
--       e.g. "TRIAL mon 5 dec 4:15"
--     long_name: "{type without underscores} {date dddd Dth mmm yyyy} {start h:mm am} - {end h:mm am}"
--       e.g. "TRIAL SESSION Monday 5th December 2026 4:15 pm - 5:45 pm"
--
--   Sessions of type = 'CLASS' continue to use subject-based names.

-- ========================
-- SESSIONS: TRIGGER FUNCTION UPDATE
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
  v_type_short TEXT;
  v_type_long TEXT;
BEGIN
  IF NEW.start_at IS NULL THEN
    NEW.short_name := NULL;
    NEW.long_name := NULL;
    RETURN NEW;
  END IF;

  v_start_adelaide := NEW.start_at AT TIME ZONE 'Australia/Adelaide';
  v_end_adelaide := COALESCE(NEW.end_at, NEW.start_at) AT TIME ZONE 'Australia/Adelaide';

  -- short date: "mon 5 dec" (ddd D mmm)
  v_date_short := LOWER(TO_CHAR(v_start_adelaide, 'Dy')) || ' ' ||
    TO_CHAR(v_start_adelaide, 'FMDD') || ' ' ||
    LOWER(TO_CHAR(v_start_adelaide, 'Mon'));

  -- long date: "Monday 5th December 2026"
  v_date_long := public._format_date_ordinal(NEW.start_at);

  IF NEW.type IS DISTINCT FROM 'CLASS' THEN
    -- Non-class sessions: derive names from NEW.type (cast enum to text for split_part/REPLACE)
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
    -- Class sessions: keep subject-based naming
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

COMMENT ON FUNCTION public.update_session_names() IS 'Trigger function that sets sessions.short_name and sessions.long_name using subject for CLASS sessions, or sessions.type for non-class sessions (Adelaide timezone).';

-- ========================
-- SESSIONS: REFRESH ON SUBJECT UPDATE (CLASS ONLY)
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
      AND s.start_at IS NOT NULL
      AND s.type = 'CLASS';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.refresh_session_names_on_subject_update() IS 'Refresh sessions.short_name and long_name for CLASS sessions when subject names change.';

DROP TRIGGER IF EXISTS trigger_refresh_session_names_on_subject_update ON public.subjects;

CREATE TRIGGER trigger_refresh_session_names_on_subject_update
  AFTER UPDATE OF short_name, long_name ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_session_names_on_subject_update();

-- ========================
-- BACKFILL EXISTING DATA
-- ========================

-- Backfill CLASS sessions (subject-based)
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
  AND s.start_at IS NOT NULL
  AND s.type = 'CLASS';

-- Backfill non-CLASS sessions (type-based; cast enum to text for split_part/REPLACE)
UPDATE public.sessions s
SET
  short_name = TRIM(CONCAT(
    COALESCE(NULLIF(split_part(s.type::text, '_', 1), ''), s.type::text),
    CASE WHEN s.type IS NOT NULL THEN ' ' ELSE '' END,
    LOWER(TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Dy')) || ' ' ||
      TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMDD') || ' ' ||
      LOWER(TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'Mon')),
    ' ',
    TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI')
  )),
  long_name = TRIM(CONCAT(
    REPLACE(s.type::text, '_', ' '),
    ' ',
    public._format_date_ordinal(s.start_at),
    ' ',
    TO_CHAR(s.start_at AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI am'),
    ' - ',
    TO_CHAR(COALESCE(s.end_at, s.start_at) AT TIME ZONE 'Australia/Adelaide', 'FMHH12:MI am')
  ))
WHERE s.start_at IS NOT NULL
  AND s.type IS NOT NULL
  AND s.type <> 'CLASS';
