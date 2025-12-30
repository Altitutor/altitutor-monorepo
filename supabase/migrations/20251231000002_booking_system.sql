-- Migration: Booking System (ALTI-19)
-- Description:
--   - Create slot_reservations table for temporary slot holds
--   - Create availability calculation function
--   - Create staff assignment function
--   - Create booking creation function
--   - Set up RLS policies and views

-- ========================
-- 1. CREATE SLOT_RESERVATIONS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.slot_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  session_type public.session_type NOT NULL,
  subject_id UUID REFERENCES public.subjects(id),
  staff_id UUID REFERENCES public.staff(id), -- Reserved staff assignment
  reserved_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT slot_reservations_valid_range CHECK (end_at > start_at)
);

-- Indexes for cleanup and availability checks
CREATE INDEX IF NOT EXISTS idx_slot_reservations_expires ON public.slot_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_slot_reservations_range ON public.slot_reservations USING GIST (tstzrange(start_at, end_at));
CREATE INDEX IF NOT EXISTS idx_slot_reservations_staff ON public.slot_reservations(staff_id);
CREATE INDEX IF NOT EXISTS idx_slot_reservations_type ON public.slot_reservations(session_type);

-- Comments
COMMENT ON TABLE public.slot_reservations IS 'Temporary reservations for booking slots (10 minute expiry)';
COMMENT ON COLUMN public.slot_reservations.staff_id IS 'Reserved staff assignment (prevents double-booking)';

-- ========================
-- 2. AVAILABILITY CALCULATION FUNCTION
-- ========================
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_start_date DATE,
  p_end_date DATE,
  p_session_type public.session_type,
  p_subject_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  available_staff_ids UUID[],
  is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_duration INTEGER;
  v_booking_buffer INTEGER;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_opening_start TIME;
  v_opening_end TIME;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_slot_start_time TIME;
  v_available_staff UUID[];
BEGIN
  -- Get booking settings
  SELECT 
    COALESCE((SELECT setting_value::INTEGER FROM booking_settings WHERE setting_key = 'slot_duration_minutes'), 15),
    COALESCE((SELECT setting_value::INTEGER FROM booking_settings WHERE setting_key = 'booking_buffer_minutes'), 0)
  INTO v_slot_duration, v_booking_buffer;

  -- Loop through each day in the date range
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0=Sunday, 6=Saturday
    
    -- Get opening hours for this day
    SELECT start_time, end_time INTO v_opening_start, v_opening_end
    FROM opening_hours
    WHERE day_of_week = v_day_of_week AND is_active = true
    LIMIT 1;
    
    -- Skip if no opening hours for this day
    IF v_opening_start IS NULL OR v_opening_end IS NULL THEN
      v_current_date := v_current_date + INTERVAL '1 day';
      CONTINUE;
    END IF;
    
    -- Generate time slots for this day
    v_slot_start_time := v_opening_start;
    WHILE v_slot_start_time < v_opening_end LOOP
      -- Convert to timestamptz (assume Adelaide timezone)
      v_slot_start := (v_current_date::TEXT || ' ' || v_slot_start_time::TEXT)::TIMESTAMP AT TIME ZONE 'Australia/Adelaide';
      v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL;
      
      -- Check if slot end time exceeds opening hours
      IF v_slot_end::TIME > v_opening_end THEN
        v_slot_start_time := v_opening_end; -- Move to next day
        CONTINUE;
      END IF;
      
      -- Find available staff for this slot
      SELECT ARRAY_AGG(staff_id) INTO v_available_staff
      FROM (
        SELECT DISTINCT s.id AS staff_id
        FROM staff s
        WHERE s.status = 'ACTIVE'
          -- Check day-of-week availability
          AND (
            (v_day_of_week = 1 AND s.availability_monday = true) OR
            (v_day_of_week = 2 AND s.availability_tuesday = true) OR
            (v_day_of_week = 3 AND s.availability_wednesday = true) OR
            (v_day_of_week = 4 AND s.availability_thursday = true) OR
            (v_day_of_week = 5 AND s.availability_friday = true) OR
            (v_day_of_week = 6 AND (
              (EXTRACT(HOUR FROM v_slot_start_time) < 12 AND s.availability_saturday_am = true) OR
              (EXTRACT(HOUR FROM v_slot_start_time) >= 12 AND s.availability_saturday_pm = true)
            )) OR
            (v_day_of_week = 0 AND (
              (EXTRACT(HOUR FROM v_slot_start_time) < 12 AND s.availability_sunday_am = true) OR
              (EXTRACT(HOUR FROM v_slot_start_time) >= 12 AND s.availability_sunday_pm = true)
            ))
          )
          -- Check session-type availability
          AND (
            (p_session_type = 'DRAFTING' AND s.drafting_availability = true) OR
            (p_session_type = 'TRIAL_SESSION' AND s.trial_session_availability = true) OR
            (p_session_type = 'SUBSIDY_INTERVIEW' AND s.subsidy_interview_availability = true) OR
            (p_session_type IN ('CLASS', 'EXAM_COURSE', 'STAFF_INTERVIEW')) -- No specific flag for these
          )
          -- Check subject match (for drafting sessions)
          AND (
            p_subject_id IS NULL OR
            p_session_type != 'DRAFTING' OR
            EXISTS (
              SELECT 1 FROM staff_subjects ss
              WHERE ss.staff_id = s.id AND ss.subject_id = p_subject_id
            )
          )
          -- Exclude blockouts
          AND NOT EXISTS (
            SELECT 1 FROM booking_staff_unavailability bu
            WHERE bu.staff_id = s.id
              AND tstzrange(bu.start_at, bu.end_at) && tstzrange(v_slot_start, v_slot_end)
          )
          -- Exclude existing sessions
          AND NOT EXISTS (
            SELECT 1 FROM sessions sess
            JOIN sessions_staff ss ON ss.session_id = sess.id
            WHERE ss.staff_id = s.id
              AND sess.status != 'CANCELLED'
              AND tstzrange(sess.start_at, sess.end_at) && tstzrange(v_slot_start, v_slot_end)
          )
          -- Exclude active reservations
          AND NOT EXISTS (
            SELECT 1 FROM slot_reservations sr
            WHERE sr.staff_id = s.id
              AND sr.expires_at > NOW()
              AND tstzrange(sr.start_at, sr.end_at) && tstzrange(v_slot_start, v_slot_end)
          )
          -- Check buffer time (if configured)
          AND (
            v_booking_buffer = 0 OR
            (
              -- No session ending within buffer time before
              NOT EXISTS (
                SELECT 1 FROM sessions sess
                JOIN sessions_staff ss ON ss.session_id = sess.id
                WHERE ss.staff_id = s.id
                  AND sess.status != 'CANCELLED'
                  AND sess.end_at > v_slot_start - (v_booking_buffer || ' minutes')::INTERVAL
                  AND sess.end_at <= v_slot_start
              )
              -- No session starting within buffer time after
              AND NOT EXISTS (
                SELECT 1 FROM sessions sess
                JOIN sessions_staff ss ON ss.session_id = sess.id
                WHERE ss.staff_id = s.id
                  AND sess.status != 'CANCELLED'
                  AND sess.start_at >= v_slot_end
                  AND sess.start_at < v_slot_end + (v_booking_buffer || ' minutes')::INTERVAL
              )
            )
          )
      ) available_staff_query;
      
      -- Return slot if staff available
      IF v_available_staff IS NOT NULL AND array_length(v_available_staff, 1) > 0 THEN
        start_at := v_slot_start;
        end_at := v_slot_end;
        available_staff_ids := v_available_staff;
        is_available := true;
        RETURN NEXT;
      END IF;
      
      -- Move to next slot
      v_slot_start_time := v_slot_start_time + (v_slot_duration || ' minutes')::INTERVAL;
    END LOOP;
    
    -- Move to next day
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_available_slots IS 'Calculate available booking slots based on opening hours, staff availability, blockouts, existing sessions, and reservations';

-- ========================
-- 3. STAFF ASSIGNMENT FUNCTION
-- ========================
CREATE OR REPLACE FUNCTION public.assign_staff_to_booking(
  p_session_type public.session_type,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_available_staff_ids UUID[],
  p_subject_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_staff_id UUID;
  v_day_start TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_closest_staff_id UUID;
  v_closest_diff INTERVAL;
  v_adminstaff_id UUID;
  v_future_session_count INTEGER;
BEGIN
  -- If no available staff, return NULL
  IF p_available_staff_ids IS NULL OR array_length(p_available_staff_ids, 1) = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Get day boundaries (Adelaide timezone)
  v_day_start := DATE_TRUNC('day', p_start_at AT TIME ZONE 'Australia/Adelaide') AT TIME ZONE 'Australia/Adelaide';
  v_day_end := v_day_start + INTERVAL '1 day';
  
  -- Priority 1: Staff with closest session time (same day, non-overlapping)
  WITH closest_sessions AS (
    SELECT 
      ss.staff_id,
      MIN(
        CASE 
          WHEN sess.end_at <= p_start_at THEN p_start_at - sess.end_at
          WHEN sess.start_at >= p_end_at THEN sess.start_at - p_end_at
          ELSE NULL
        END
      ) AS diff
    FROM sessions sess
    JOIN sessions_staff ss ON ss.session_id = sess.id
    WHERE ss.staff_id = ANY(p_available_staff_ids)
      AND sess.status != 'CANCELLED'
      AND sess.start_at >= v_day_start
      AND sess.start_at < v_day_end
      AND (
        (sess.end_at <= p_start_at) OR
        (sess.start_at >= p_end_at)
      )
    GROUP BY ss.staff_id
  ),
  closest_staff AS (
    SELECT staff_id, diff
    FROM closest_sessions
    WHERE diff IS NOT NULL
    ORDER BY diff ASC
    LIMIT 1
  )
  SELECT staff_id INTO v_closest_staff_id FROM closest_staff;
  
  -- If found, check tie-breaker: least future sessions
  IF v_closest_staff_id IS NOT NULL THEN
    SELECT s.id INTO v_assigned_staff_id
    FROM staff s
    WHERE s.id = v_closest_staff_id
    ORDER BY (
      SELECT COUNT(*) FROM sessions sess
      JOIN sessions_staff ss ON ss.session_id = sess.id
      WHERE ss.staff_id = s.id
        AND sess.status != 'CANCELLED'
        AND sess.start_at > NOW()
    ) ASC, s.first_name ASC, s.last_name ASC
    LIMIT 1;
    
    IF v_assigned_staff_id IS NOT NULL THEN
      RETURN v_assigned_staff_id;
    END IF;
  END IF;
  
  -- Priority 2: ADMINSTAFF with availability (if no sessions on day)
  SELECT s.id INTO v_adminstaff_id
  FROM staff s
  WHERE s.id = ANY(p_available_staff_ids)
    AND s.role = 'ADMINSTAFF'
    AND s.status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1 FROM sessions sess
      JOIN sessions_staff ss ON ss.session_id = sess.id
      WHERE ss.staff_id = s.id
        AND sess.status != 'CANCELLED'
        AND sess.start_at >= v_day_start
        AND sess.start_at < v_day_end
    )
  ORDER BY (
    SELECT COUNT(*) FROM sessions sess
    JOIN sessions_staff ss ON ss.session_id = sess.id
    WHERE ss.staff_id = s.id
      AND sess.status != 'CANCELLED'
      AND sess.start_at > NOW()
  ) ASC, s.first_name ASC, s.last_name ASC
  LIMIT 1;
  
  IF v_adminstaff_id IS NOT NULL THEN
    RETURN v_adminstaff_id;
  END IF;
  
  -- Priority 3: Any available staff (least future sessions, then alphabetical)
  SELECT s.id INTO v_assigned_staff_id
  FROM staff s
  WHERE s.id = ANY(p_available_staff_ids)
    AND s.status = 'ACTIVE'
  ORDER BY (
    SELECT COUNT(*) FROM sessions sess
    JOIN sessions_staff ss ON ss.session_id = sess.id
    WHERE ss.staff_id = s.id
      AND sess.status != 'CANCELLED'
      AND sess.start_at > NOW()
  ) ASC, s.first_name ASC, s.last_name ASC
  LIMIT 1;
  
  RETURN v_assigned_staff_id;
END;
$$;

COMMENT ON FUNCTION public.assign_staff_to_booking IS 'Assign staff to booking based on priority: closest session time, ADMINSTAFF availability, least future sessions';

-- ========================
-- 4. BOOKING CREATION FUNCTION
-- ========================
CREATE OR REPLACE FUNCTION public.create_booking_session(
  p_session_type public.session_type,
  p_student_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ,
  p_subject_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_reservation_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_assigned_staff_id UUID;
  v_available_staff_ids UUID[];
  v_reservation_record RECORD;
BEGIN
  -- Validate reservation if provided
  IF p_reservation_id IS NOT NULL THEN
    SELECT * INTO v_reservation_record
    FROM slot_reservations
    WHERE id = p_reservation_id
      AND expires_at > NOW();
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reservation expired or not found';
    END IF;
    
    -- Validate slot matches reservation
    IF v_reservation_record.start_at != p_start_at OR v_reservation_record.end_at != p_end_at THEN
      RAISE EXCEPTION 'Slot does not match reservation';
    END IF;
    
    -- Use reserved staff if available
    IF v_reservation_record.staff_id IS NOT NULL THEN
      v_assigned_staff_id := v_reservation_record.staff_id;
    END IF;
  END IF;
  
  -- Get available staff for slot if not assigned
  IF v_assigned_staff_id IS NULL THEN
    SELECT available_staff_ids INTO v_available_staff_ids
    FROM get_available_slots(
      p_start_at::DATE,
      p_start_at::DATE,
      p_session_type,
      p_subject_id,
      EXTRACT(EPOCH FROM (p_end_at - p_start_at))::INTEGER / 60
    )
    WHERE start_at = p_start_at AND end_at = p_end_at
    LIMIT 1;
    
    IF v_available_staff_ids IS NULL OR array_length(v_available_staff_ids, 1) = 0 THEN
      RAISE EXCEPTION 'No staff available for this slot';
    END IF;
    
    -- Auto-assign staff
    v_assigned_staff_id := assign_staff_to_booking(
      p_session_type,
      p_start_at,
      p_end_at,
      v_available_staff_ids,
      p_subject_id
    );
    
    IF v_assigned_staff_id IS NULL THEN
      RAISE EXCEPTION 'Failed to assign staff';
    END IF;
  END IF;
  
  -- Create session
  INSERT INTO sessions (
    id,
    type,
    subject_id,
    start_at,
    end_at,
    status,
    created_by
  ) VALUES (
    gen_random_uuid(),
    p_session_type,
    p_subject_id,
    p_start_at,
    p_end_at,
    'SCHEDULED',
    p_created_by
  )
  RETURNING id INTO v_session_id;
  
  -- Link student
  INSERT INTO sessions_students (
    id,
    session_id,
    student_id
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    p_student_id
  );
  
  -- Link staff
  INSERT INTO sessions_staff (
    id,
    session_id,
    staff_id,
    type,
    created_by
  ) VALUES (
    gen_random_uuid(),
    v_session_id,
    v_assigned_staff_id,
    CASE 
      WHEN p_session_type = 'TRIAL_SESSION' THEN 'TRIAL_TUTOR'
      ELSE 'MAIN_TUTOR'
    END,
    p_created_by
  );
  
  -- Delete reservation if provided
  IF p_reservation_id IS NOT NULL THEN
    DELETE FROM slot_reservations WHERE id = p_reservation_id;
  END IF;
  
  RETURN v_session_id;
END;
$$;

COMMENT ON FUNCTION public.create_booking_session IS 'Create a booking session with automatic staff assignment and student/staff linking';

-- ========================
-- 5. RLS POLICIES
-- ========================

-- slot_reservations: AdminStaff full access, others read own reservations
ALTER TABLE public.slot_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to slot_reservations" ON public.slot_reservations;
CREATE POLICY "ADMINSTAFF full access to slot_reservations" ON public.slot_reservations
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Allow authenticated users to read their own reservations
DROP POLICY IF EXISTS "Users can read own reservations" ON public.slot_reservations;
CREATE POLICY "Users can read own reservations" ON public.slot_reservations
  FOR SELECT TO authenticated
  USING (reserved_by = auth.uid());

-- Allow authenticated users to create reservations
DROP POLICY IF EXISTS "Users can create reservations" ON public.slot_reservations;
CREATE POLICY "Users can create reservations" ON public.slot_reservations
  FOR INSERT TO authenticated
  WITH CHECK (reserved_by = auth.uid());

-- Allow authenticated users to delete their own reservations
DROP POLICY IF EXISTS "Users can delete own reservations" ON public.slot_reservations;
CREATE POLICY "Users can delete own reservations" ON public.slot_reservations
  FOR DELETE TO authenticated
  USING (reserved_by = auth.uid());

-- ========================
-- 6. GRANTS
-- ========================
GRANT SELECT, INSERT, DELETE ON public.slot_reservations TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_staff_to_booking TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_session TO authenticated;

