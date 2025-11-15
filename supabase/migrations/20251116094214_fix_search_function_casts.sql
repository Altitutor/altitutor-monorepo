-- Migration: Fix search function casts for lint compliance
-- Description: Provide overloads for format_class_short_name/full_name that accept
-- subject_curriculum enums and text time fields so existing search functions pass lint.

-- Wrapper accepting subject_curriculum (time already typed)
CREATE OR REPLACE FUNCTION format_class_short_name(
  p_day_of_week INTEGER,
  p_start_time TIME,
  p_curriculum subject_curriculum,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format_class_short_name(
    p_day_of_week,
    p_start_time,
    p_curriculum::TEXT,
    p_year_level,
    p_name
  );
$$;

-- Wrapper accepting text time and subject_curriculum
CREATE OR REPLACE FUNCTION format_class_short_name(
  p_day_of_week INTEGER,
  p_start_time TEXT,
  p_curriculum subject_curriculum,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format_class_short_name(
    p_day_of_week,
    NULLIF(p_start_time, '')::TIME,
    p_curriculum,
    p_year_level,
    p_name
  );
$$;

-- Wrapper accepting subject_curriculum (times already typed)
CREATE OR REPLACE FUNCTION format_class_full_name(
  p_day_of_week INTEGER,
  p_start_time TIME,
  p_end_time TIME,
  p_curriculum subject_curriculum,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format_class_full_name(
    p_day_of_week,
    p_start_time,
    p_end_time,
    p_curriculum::TEXT,
    p_year_level,
    p_name
  );
$$;

-- Wrapper accepting text times and subject_curriculum
CREATE OR REPLACE FUNCTION format_class_full_name(
  p_day_of_week INTEGER,
  p_start_time TEXT,
  p_end_time TEXT,
  p_curriculum subject_curriculum,
  p_year_level INTEGER,
  p_name TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format_class_full_name(
    p_day_of_week,
    NULLIF(p_start_time, '')::TIME,
    NULLIF(p_end_time, '')::TIME,
    p_curriculum,
    p_year_level,
    p_name
  );
$$;

GRANT EXECUTE ON FUNCTION format_class_short_name(INTEGER, TIME, subject_curriculum, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION format_class_short_name(INTEGER, TEXT, subject_curriculum, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION format_class_full_name(INTEGER, TIME, TIME, subject_curriculum, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION format_class_full_name(INTEGER, TEXT, TEXT, subject_curriculum, INTEGER, TEXT) TO authenticated;

