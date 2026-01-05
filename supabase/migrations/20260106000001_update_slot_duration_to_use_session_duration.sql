-- Migration: Update get_available_slots to use session duration for slot generation
-- Description: Instead of using global slot_duration_minutes setting, use the session duration
-- (p_duration_minutes) to generate slots. This means slots will be generated at intervals
-- matching the session duration (e.g., 45-minute sessions generate slots every 45 minutes).

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
  -- Get booking buffer setting (slot_duration_minutes is no longer needed)
  SELECT 
    COALESCE((SELECT setting_value::INTEGER FROM booking_settings WHERE setting_key = 'booking_buffer_minutes'), 0)
  INTO v_booking_buffer;

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
    -- Use session duration (p_duration_minutes) for slot intervals
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
      
      -- Move to next slot using session duration (not global slot_duration_minutes)
      v_slot_start_time := v_slot_start_time + (p_duration_minutes || ' minutes')::INTERVAL;
    END LOOP;
    
    -- Move to next day
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_available_slots IS 'Calculate available booking slots based on opening hours, staff availability, blockouts, existing sessions, and reservations. Slots are generated at intervals matching the session duration.';

