-- Migration: Add get_available_reschedule_sessions RPC function
-- This function returns available sessions for rescheduling based on:
-- - Same subject as original session
-- - Different class than original session
-- - Future sessions (start_at > now)
-- - Student not already enrolled
-- - Within date range of original session
-- Works for both admin-web and student-web contexts

CREATE OR REPLACE FUNCTION get_available_reschedule_sessions(
  p_original_session_id UUID,
  p_student_id UUID,
  p_date_range_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_session RECORD;
  v_subject_id UUID;
  v_original_class_id UUID;
  v_original_start_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_effective_start_date TIMESTAMPTZ;
  v_session RECORD;
  v_result JSONB := '[]'::JSONB;
  v_session_array JSONB := '[]'::JSONB;
  v_enrolled_session_ids UUID[];
  v_student_count INTEGER;
BEGIN
  -- Get original session details
  SELECT 
    s.id,
    s.start_at,
    s.end_at,
    s.class_id,
    s.type,
    s.status,
    s.created_at,
    s.updated_at,
    c.subject_id
  INTO v_original_session
  FROM sessions s
  LEFT JOIN classes c ON c.id = s.class_id
  WHERE s.id = p_original_session_id;

  -- Validate original session exists and has a subject
  IF NOT FOUND OR v_original_session.subject_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  v_subject_id := v_original_session.subject_id;
  v_original_class_id := v_original_session.class_id;
  v_original_start_at := v_original_session.start_at;

  -- Calculate date range
  v_start_date := v_original_start_at - (p_date_range_days || ' days')::INTERVAL;
  v_end_date := v_original_start_at + (p_date_range_days || ' days')::INTERVAL;

  -- Ensure start date is not in the past
  v_effective_start_date := GREATEST(v_start_date, v_now);

  -- Get sessions where student is already enrolled (all enrollments)
  SELECT ARRAY_AGG(session_id)
  INTO v_enrolled_session_ids
  FROM sessions_students
  WHERE student_id = p_student_id;

  -- If no enrollments, set to empty array
  IF v_enrolled_session_ids IS NULL THEN
    v_enrolled_session_ids := ARRAY[]::UUID[];
  END IF;

  -- Get available sessions with same subject, different class, within date range
  -- Exclude sessions where student is already enrolled
  FOR v_session IN
    SELECT 
      s.id,
      s.start_at,
      s.end_at,
      s.class_id,
      s.type,
      s.status,
      s.created_at,
      s.updated_at,
      -- Class details
      jsonb_build_object(
        'id', c.id,
        'day_of_week', c.day_of_week,
        'start_time', c.start_time,
        'end_time', c.end_time,
        'room', c.room,
        'level', c.level,
        'status', c.status,
        'subject_id', c.subject_id,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      ) as class,
      -- Subject details
      jsonb_build_object(
        'id', sub.id,
        'name', sub.name,
        'curriculum', sub.curriculum,
        'discipline', sub.discipline,
        'level', sub.level,
        'color', sub.color,
        'year_level', sub.year_level,
        'created_at', sub.created_at,
        'updated_at', sub.updated_at
      ) as subject
    FROM sessions s
    JOIN classes c ON c.id = s.class_id
    JOIN subjects sub ON sub.id = c.subject_id
    WHERE c.subject_id = v_subject_id
      AND s.class_id != v_original_class_id
      AND s.start_at >= v_effective_start_date
      AND s.start_at <= v_end_date
      AND s.id != ALL(v_enrolled_session_ids)  -- Exclude sessions student is already enrolled in
    ORDER BY s.start_at ASC
  LOOP
    -- Get student count for this session (excluding planned absences)
    SELECT COUNT(*)
    INTO v_student_count
    FROM sessions_students
    WHERE session_id = v_session.id
      AND planned_absence = false;

    -- Build session JSONB object and add to array
    v_session_array := v_session_array || jsonb_build_array(
      jsonb_build_object(
        'id', v_session.id,
        'start_at', v_session.start_at,
        'end_at', v_session.end_at,
        'class_id', v_session.class_id,
        'type', v_session.type,
        'status', v_session.status,
        'created_at', v_session.created_at,
        'updated_at', v_session.updated_at,
        'class', v_session.class,
        'subject', v_session.subject,
        'studentCount', COALESCE(v_student_count, 0)
      )
    );
  END LOOP;

  RETURN v_session_array;
EXCEPTION
  WHEN OTHERS THEN
    -- Return empty array on error (client will handle error logging)
    RETURN '[]'::JSONB;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_available_reschedule_sessions(UUID, UUID, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_available_reschedule_sessions(UUID, UUID, INTEGER) IS 
  'Returns available sessions for rescheduling: same subject, different class, future sessions, student not enrolled, within date range. Works for both admin and student contexts.';
