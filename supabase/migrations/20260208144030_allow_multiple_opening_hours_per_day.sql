-- Migration: Allow Multiple Opening Hours Per Day (Support Lunch Breaks)
-- Description:
--   - Remove UNIQUE constraint on opening_hours.day_of_week to allow multiple time ranges per day
--   - Update get_available_slots() to handle multiple opening hours ranges per day
--   - Automatically creates breaks between non-contiguous time ranges (e.g., 9-12 and 1-4 creates 12-1 break)
--   - Preserves all existing functionality: admin shifts, buffer times, date restrictions, staff availability
-- Related Issue: Support lunch breaks in booking availability

-- ========================
-- 1. REMOVE UNIQUE CONSTRAINT ON OPENING_HOURS
-- ========================

-- Drop the unique constraint that prevents multiple opening hours per day
ALTER TABLE public.opening_hours
  DROP CONSTRAINT IF EXISTS opening_hours_unique_day;

-- Update comment to reflect new capability
COMMENT ON TABLE public.opening_hours IS 'Business opening hours by day of week (0=Sunday, 6=Saturday). Multiple time ranges per day are supported to allow lunch breaks and other gaps. Gaps between ranges automatically create break periods where no bookings can be made.';

-- ========================
-- 2. UPDATE GET_AVAILABLE_SLOTS FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_start_date DATE,
  p_end_date DATE,
  p_session_type public.session_type,
  p_subject_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 60,
  p_bypass_date_restrictions BOOLEAN DEFAULT NULL
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
  v_min_advance_days INTEGER;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_opening_start TIME;
  v_opening_end TIME;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_slot_start_time TIME;
  v_available_staff UUID[];
  v_now_adelaide TIMESTAMPTZ;
  v_min_booking_date DATE;
  v_bypass_restrictions BOOLEAN;
  v_opening_hours_record RECORD;
BEGIN
  -- Clean up expired reservations at the start of the function call
  DELETE FROM slot_reservations WHERE expires_at <= NOW();
  
  -- Determine if we should bypass date restrictions
  -- If p_bypass_date_restrictions is NULL, auto-detect admin status
  IF p_bypass_date_restrictions IS NULL THEN
    v_bypass_restrictions := public.is_adminstaff_active();
  ELSE
    v_bypass_restrictions := p_bypass_date_restrictions;
  END IF;
  
  -- Get booking settings
  SELECT 
    COALESCE((SELECT setting_value::INTEGER FROM booking_settings WHERE setting_key = 'booking_buffer_minutes'), 0),
    COALESCE((SELECT setting_value::INTEGER FROM booking_settings WHERE setting_key = 'min_advance_booking_days'), 1)
  INTO v_booking_buffer, v_min_advance_days;
  
  -- Get current time in Adelaide timezone
  v_now_adelaide := NOW() AT TIME ZONE 'Australia/Adelaide';
  
  -- Calculate minimum booking date (today + minimum advance days)
  -- Only apply if not bypassing restrictions
  IF NOT v_bypass_restrictions THEN
    v_min_booking_date := (v_now_adelaide::DATE) + (v_min_advance_days || ' days')::INTERVAL;
    
    -- Ensure start_date is at least the minimum booking date
    IF p_start_date < v_min_booking_date THEN
      p_start_date := v_min_booking_date;
    END IF;
  ELSE
    -- For admin bypass, allow any date (including past dates)
    -- Don't adjust p_start_date, allow it to be any date
    -- Set v_min_booking_date to a very early date so all slots pass the date check
    v_min_booking_date := '1900-01-01'::DATE;
  END IF;

  -- Loop through each day in the date range
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date); -- 0=Sunday, 6=Saturday
    
    -- Loop through all active opening hours ranges for this day
    -- Order by start_time to process ranges in chronological order
    -- Gaps between ranges automatically create break periods (no slots generated)
    FOR v_opening_hours_record IN
      SELECT start_time, end_time
      FROM opening_hours
      WHERE day_of_week = v_day_of_week AND is_active = true
      ORDER BY start_time ASC
    LOOP
      v_opening_start := v_opening_hours_record.start_time;
      v_opening_end := v_opening_hours_record.end_time;
      
      -- Generate time slots for this opening hours range
      -- Use session duration (p_duration_minutes) for slot intervals
      v_slot_start_time := v_opening_start;
      WHILE v_slot_start_time < v_opening_end LOOP
        -- Convert to timestamptz (assume Adelaide timezone)
        v_slot_start := (v_current_date::TEXT || ' ' || v_slot_start_time::TEXT)::TIMESTAMP AT TIME ZONE 'Australia/Adelaide';
        v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL;
        
        -- Skip if slot is in the past (only if not bypassing restrictions)
        IF NOT v_bypass_restrictions AND v_slot_start < v_now_adelaide THEN
          v_slot_start_time := v_slot_start_time + (p_duration_minutes || ' minutes')::INTERVAL;
          CONTINUE;
        END IF;
        
        -- Skip if slot doesn't meet minimum advance booking requirement (only if not bypassing restrictions)
        IF NOT v_bypass_restrictions AND v_slot_start::DATE < v_min_booking_date THEN
          v_slot_start_time := v_slot_start_time + (p_duration_minutes || ' minutes')::INTERVAL;
          CONTINUE;
        END IF;
        
        -- Check if slot end time exceeds opening hours range
        -- FIX: Convert to Adelaide timezone before extracting TIME component
        IF (v_slot_end AT TIME ZONE 'Australia/Adelaide')::TIME > v_opening_end THEN
          -- Move to next opening hours range (or next day if this was the last range)
          EXIT; -- Exit inner WHILE loop to move to next opening hours range
        END IF;
        
        -- Find available staff for this slot
        SELECT ARRAY_AGG(staff_id) INTO v_available_staff
        FROM (
          SELECT DISTINCT s.id AS staff_id
          FROM staff s
          WHERE s.status = 'ACTIVE'
            -- Check day-of-week availability OR ADMIN_SHIFT override
            -- ADMIN_SHIFT at this time overrides day-of-week availability requirement
            AND (
              -- Option 1: Staff has ADMIN_SHIFT that overlaps with this slot
              EXISTS (
                SELECT 1 FROM sessions admin_sess
                JOIN sessions_staff admin_ss ON admin_ss.session_id = admin_sess.id
                WHERE admin_ss.staff_id = s.id
                  AND admin_sess.type = 'ADMIN_SHIFT'
                  AND admin_sess.status != 'CANCELLED'
                  AND tstzrange(admin_sess.start_at, admin_sess.end_at) && tstzrange(v_slot_start, v_slot_end)
              )
              -- Option 2: Staff has normal day-of-week availability
              OR (
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
            )
            -- Check session-type availability (capability flags still required)
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
            -- Exclude blockouts (blockouts override admin shift)
            AND NOT EXISTS (
              SELECT 1 FROM booking_staff_unavailability bu
              WHERE bu.staff_id = s.id
                AND tstzrange(bu.start_at, bu.end_at) && tstzrange(v_slot_start, v_slot_end)
            )
            -- Exclude non-ADMIN_SHIFT concurrent sessions (ADMIN_SHIFT sessions don't block)
            -- If staff has ADMIN_SHIFT 9am-12pm and another session 10am-11am,
            -- they're not available 10am-11am but available for rest of admin shift
            AND NOT EXISTS (
              SELECT 1 FROM sessions sess
              JOIN sessions_staff ss ON ss.session_id = sess.id
              WHERE ss.staff_id = s.id
                AND sess.status != 'CANCELLED'
                AND sess.type != 'ADMIN_SHIFT' -- ADMIN_SHIFT sessions don't block
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
            -- Buffer time applies to non-ADMIN_SHIFT sessions only
            AND (
              v_booking_buffer = 0 OR
              (
                -- No non-ADMIN_SHIFT session ending within buffer time before
                NOT EXISTS (
                  SELECT 1 FROM sessions sess
                  JOIN sessions_staff ss ON ss.session_id = sess.id
                  WHERE ss.staff_id = s.id
                    AND sess.status != 'CANCELLED'
                    AND sess.type != 'ADMIN_SHIFT' -- Exclude ADMIN_SHIFT from buffer checks
                    AND sess.end_at > v_slot_start - (v_booking_buffer || ' minutes')::INTERVAL
                    AND sess.end_at <= v_slot_start
                )
                -- No non-ADMIN_SHIFT session starting within buffer time after
                AND NOT EXISTS (
                  SELECT 1 FROM sessions sess
                  JOIN sessions_staff ss ON ss.session_id = sess.id
                  WHERE ss.staff_id = s.id
                    AND sess.status != 'CANCELLED'
                    AND sess.type != 'ADMIN_SHIFT' -- Exclude ADMIN_SHIFT from buffer checks
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
      END LOOP; -- End of slot generation loop for this opening hours range
    END LOOP; -- End of opening hours ranges loop for this day
    
    -- Move to next day
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP; -- End of date range loop
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_available_slots(p_start_date date, p_end_date date, p_session_type public.session_type, p_subject_id uuid, p_duration_minutes integer, p_bypass_date_restrictions boolean) IS 'Calculate available booking slots based on opening hours, staff availability, blockouts, existing sessions, and reservations. Supports multiple opening hours ranges per day (e.g., 9-12 and 1-4) with automatic breaks between ranges. ADMIN_SHIFT sessions override day-of-week availability but do not block bookings. Capability flags still required. Blockouts override admin shift. Non-ADMIN_SHIFT concurrent sessions still block availability. Buffer time applies to non-ADMIN_SHIFT sessions only. Slots are generated at intervals matching the session duration. Filters out past dates and enforces minimum advance booking days requirement for students. Admins can bypass date restrictions via p_bypass_date_restrictions parameter (auto-detected if NULL).';
