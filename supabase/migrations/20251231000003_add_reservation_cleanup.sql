-- Migration: Add Reservation Cleanup (ALTI-19)
-- Description: Add automatic cleanup of expired reservations in get_available_slots function
-- This avoids the need for a separate Edge Function or cron job

-- ========================
-- 1. UPDATE get_available_slots TO CLEANUP EXPIRED RESERVATIONS
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
  -- Cleanup expired reservations at the start of each availability check
  -- This ensures expired reservations don't accumulate in the database
  DELETE FROM slot_reservations WHERE expires_at <= NOW();

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
      SELECT ARRAY_AGG(s.id) INTO v_available_staff
      FROM staff s
      WHERE 
        -- Session type availability
        (
          (p_session_type = 'DRAFTING' AND s.drafting_availability = TRUE) OR
          (p_session_type = 'TRIAL_SESSION' AND s.trial_session_availability = TRUE) OR
          (p_session_type = 'SUBSIDY_INTERVIEW' AND s.subsidy_interview_availability = TRUE)
        )
        -- Day of week availability
        AND (
          (v_day_of_week = 1 AND s.availability_monday = TRUE) OR
          (v_day_of_week = 2 AND s.availability_tuesday = TRUE) OR
          (v_day_of_week = 3 AND s.availability_wednesday = TRUE) OR
          (v_day_of_week = 4 AND s.availability_thursday = TRUE) OR
          (v_day_of_week = 5 AND s.availability_friday = TRUE) OR
          (v_day_of_week = 6 AND s.availability_saturday_am = TRUE OR s.availability_saturday_pm = TRUE) OR
          (v_day_of_week = 0 AND s.availability_sunday_am = TRUE OR s.availability_sunday_pm = TRUE)
        )
        -- Not blocked out
        AND NOT EXISTS (
          SELECT 1 FROM booking_staff_unavailability bu
          WHERE bu.staff_id = s.id
            AND tstzrange(bu.start_at, bu.end_at) && tstzrange(v_slot_start, v_slot_end)
        )
        -- Not already booked
        AND NOT EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.staff_id = s.id
            AND sess.status IN ('SCHEDULED', 'IN_PROGRESS')
            AND tstzrange(sess.start_at, sess.end_at) && tstzrange(v_slot_start, v_slot_end)
        )
        -- Not reserved (only check non-expired reservations)
        AND NOT EXISTS (
          SELECT 1 FROM slot_reservations sr
          WHERE sr.staff_id = s.id
            AND tstzrange(sr.start_at, sr.end_at) && tstzrange(v_slot_start, v_slot_end)
            AND sr.expires_at > NOW()
        )
        -- Subject match if specified
        AND (p_subject_id IS NULL OR EXISTS (
          SELECT 1 FROM staff_subjects ss WHERE ss.staff_id = s.id AND ss.subject_id = p_subject_id
        ));
      
      -- Return slot with availability status
      start_at := v_slot_start;
      end_at := v_slot_end;
      available_staff_ids := COALESCE(v_available_staff, ARRAY[]::UUID[]);
      is_available := (v_available_staff IS NOT NULL AND array_length(v_available_staff, 1) > 0);
      RETURN NEXT;
      
      -- Move to next slot
      v_slot_start_time := v_slot_start_time + (v_slot_duration || ' minutes')::INTERVAL;
    END LOOP;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_available_slots IS 'Calculate available booking slots. Automatically cleans up expired reservations on each call.';

-- ========================
-- 2. CREATE OPTIONAL MANUAL CLEANUP FUNCTION (for admin use)
-- ========================
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM slot_reservations WHERE expires_at <= NOW();
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_reservations IS 'Manually cleanup expired reservations. Returns count of deleted rows. get_available_slots automatically cleans up expired reservations, so this is optional.';

GRANT EXECUTE ON FUNCTION public.cleanup_expired_reservations TO authenticated;


