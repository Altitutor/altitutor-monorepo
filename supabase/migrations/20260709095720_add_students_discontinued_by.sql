-- Store the staff member who discontinued a student.
-- The admin-web RPC has accepted p_discontinued_by since the original
-- discontinue flow, but the value was not persisted.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS discontinued_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.students.discontinued_by IS 'Staff member who changed the student status to DISCONTINUED.';

CREATE INDEX IF NOT EXISTS idx_students_discontinued_by ON public.students(discontinued_by)
  WHERE discontinued_by IS NOT NULL;

-- Best-effort historical backfill from activity events where available.
UPDATE public.students s
SET discontinued_by = (
  SELECT performed_by
  FROM public.activity_events
  WHERE entity_type = 'students'
    AND entity_id = s.id
    AND performed_by IS NOT NULL
    AND changed_fields ? 'status'
    AND changed_fields->'status'->>'new' = 'DISCONTINUED'
  ORDER BY performed_at DESC
  LIMIT 1
)
WHERE s.discontinued_by IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.activity_events
    WHERE entity_type = 'students'
      AND entity_id = s.id
      AND performed_by IS NOT NULL
      AND changed_fields ? 'status'
      AND changed_fields->'status'->>'new' = 'DISCONTINUED'
  );

CREATE OR REPLACE FUNCTION public.set_students_discontinued_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'DISCONTINUED' AND NEW.discontinued_at IS NULL THEN
    IF TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'DISCONTINUED' THEN
      NEW.discontinued_at := NOW();
      NEW.discontinued_by := COALESCE(NEW.discontinued_by, public.current_staff_id());
    END IF;
  END IF;
  -- Never clear discontinued_at or discontinued_by.
  IF TG_OP = 'UPDATE' AND OLD.status = 'DISCONTINUED' AND NEW.discontinued_at IS NULL THEN
    NEW.discontinued_at := OLD.discontinued_at;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'DISCONTINUED' AND NEW.discontinued_by IS NULL THEN
    NEW.discontinued_by := OLD.discontinued_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.discontinue_student(
  p_student_id UUID,
  p_discontinued_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_status TEXT;
  v_active_enrollments_count INTEGER;
  v_future_non_class_sessions_count INTEGER;
  v_future_sessions JSONB;
BEGIN
  -- Get current student status
  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student not found'
    );
  END IF;
  
  -- Check if student is already discontinued
  IF v_student_status = 'DISCONTINUED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student is already discontinued'
    );
  END IF;
  
  -- Check for active class enrollments
  SELECT COUNT(*) INTO v_active_enrollments_count
  FROM classes_students
  WHERE student_id = p_student_id
    AND unenrolled_at IS NULL;
  
  IF v_active_enrollments_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unenroll student from classes first'
    );
  END IF;
  
  -- Check for future sessions that should block discontinue
  -- Allow only: class sessions from past enrollments where unenrolled_at IS NOT NULL AND unenrolled_at > session.start_at
  -- Block: all non-class sessions, class sessions from active enrollments, class sessions after unenroll date
  SELECT COUNT(*) INTO v_future_non_class_sessions_count
  FROM sessions_students ss
  JOIN sessions s ON s.id = ss.session_id
  LEFT JOIN classes_students cs ON cs.class_id = s.class_id 
    AND cs.student_id = ss.student_id
    AND cs.enrolled_at <= s.start_at
    AND cs.unenrolled_at IS NOT NULL
    AND cs.unenrolled_at > s.start_at  -- Session is within past enrollment period
  WHERE ss.student_id = p_student_id
    AND s.start_at > NOW()
    AND NOT (
      -- Only allow class sessions from past enrollments with unenrolled_at > session.start_at
      s.type = 'CLASS' 
      AND cs.id IS NOT NULL
    );
  
  IF v_future_non_class_sessions_count > 0 THEN
    -- Get list of future sessions for error message
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'type', s.type,
        'start_at', s.start_at,
        'subject_id', s.subject_id
      )
    ) INTO v_future_sessions
    FROM sessions_students ss
    JOIN sessions s ON s.id = ss.session_id
    LEFT JOIN classes_students cs ON cs.class_id = s.class_id 
      AND cs.student_id = ss.student_id
      AND cs.enrolled_at <= s.start_at
      AND cs.unenrolled_at IS NOT NULL
      AND cs.unenrolled_at > s.start_at
    WHERE ss.student_id = p_student_id
      AND s.start_at > NOW()
      AND NOT (
        s.type = 'CLASS' 
        AND cs.id IS NOT NULL
      );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student has future sessions',
      'sessions', COALESCE(v_future_sessions, '[]'::jsonb)
    );
  END IF;
  
  -- Update student status to DISCONTINUED
  UPDATE students
  SET status = 'DISCONTINUED',
      discontinued_by = p_discontinued_by,
      updated_at = NOW()
  WHERE id = p_student_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student discontinued successfully'
  );
END;
$$;

COMMENT ON FUNCTION public.discontinue_student IS 'Discontinue a student. Blocks if student has active class enrollments or future non-class sessions. Allows future class sessions from past enrollments with unenroll dates. Stores the staff member who performed the discontinuation.';

GRANT EXECUTE ON FUNCTION public.discontinue_student TO authenticated;
