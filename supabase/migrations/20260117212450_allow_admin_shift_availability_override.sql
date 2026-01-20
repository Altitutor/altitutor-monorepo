-- Migration: Allow ADMIN_SHIFT to override availability and prioritize allocation
-- Description:
--   - ADMIN_SHIFT sessions no longer block staff availability
--   - Staff with ADMIN_SHIFT at a time are automatically available (override day-of-week availability)
--   - Capability flags still required (trial_session_availability, drafting_availability, etc.)
--   - Blockouts still apply (override admin shift)
--   - Non-ADMIN_SHIFT concurrent sessions still block availability
--   - Buffer time still applies (excluding ADMIN_SHIFT from buffer checks)
--   - Allocation priority: Staff with ADMIN_SHIFT first, then existing priority rules
-- Related Issue: Investigation of Lara Nguyen availability issue

-- ========================
-- UPDATE GET_AVAILABLE_SLOTS
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
      
      -- Check if slot end time exceeds opening hours
      -- FIX: Convert to Adelaide timezone before extracting TIME component
      IF (v_slot_end AT TIME ZONE 'Australia/Adelaide')::TIME > v_opening_end THEN
        v_slot_start_time := v_opening_end; -- Move to next day
        CONTINUE;
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
    END LOOP;
    
    -- Move to next day
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_available_slots(p_start_date date, p_end_date date, p_session_type public.session_type, p_subject_id uuid, p_duration_minutes integer, p_bypass_date_restrictions boolean) IS 'Calculate available booking slots based on opening hours, staff availability, blockouts, existing sessions, and reservations. ADMIN_SHIFT sessions override day-of-week availability but do not block bookings. Capability flags still required. Blockouts override admin shift. Non-ADMIN_SHIFT concurrent sessions still block availability. Buffer time applies to non-ADMIN_SHIFT sessions only. Slots are generated at intervals matching the session duration. Filters out past dates and enforces minimum advance booking days requirement for students. Admins can bypass date restrictions via p_bypass_date_restrictions parameter (auto-detected if NULL).';

-- ========================
-- UPDATE ASSIGN_STAFF_TO_BOOKING
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
  v_adminstaff_id UUID;
  v_admin_shift_staff_ids UUID[];
BEGIN
  -- If no available staff, return NULL
  IF p_available_staff_ids IS NULL OR array_length(p_available_staff_ids, 1) = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Get day boundaries (Adelaide timezone)
  v_day_start := DATE_TRUNC('day', p_start_at AT TIME ZONE 'Australia/Adelaide') AT TIME ZONE 'Australia/Adelaide';
  v_day_end := v_day_start + INTERVAL '1 day';
  
  -- Priority 0: Staff with ADMIN_SHIFT at this time
  -- Among staff with ADMIN_SHIFT, apply closest session time, then least future sessions
  SELECT ARRAY_AGG(DISTINCT s.id) INTO v_admin_shift_staff_ids
  FROM staff s
  WHERE s.id = ANY(p_available_staff_ids)
    AND EXISTS (
      SELECT 1 FROM sessions admin_sess
      JOIN sessions_staff admin_ss ON admin_ss.session_id = admin_sess.id
      WHERE admin_ss.staff_id = s.id
        AND admin_sess.type = 'ADMIN_SHIFT'
        AND admin_sess.status != 'CANCELLED'
        AND tstzrange(admin_sess.start_at, admin_sess.end_at) && tstzrange(p_start_at, p_end_at)
    );
  
  -- If we have staff with ADMIN_SHIFT, prioritize them using existing logic
  IF v_admin_shift_staff_ids IS NOT NULL AND array_length(v_admin_shift_staff_ids, 1) > 0 THEN
    -- Priority 0a: Among ADMIN_SHIFT staff, find closest session time (same day, non-overlapping)
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
      WHERE ss.staff_id = ANY(v_admin_shift_staff_ids)
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
    
    -- Priority 0b: Among ADMIN_SHIFT staff, choose by least future sessions
    SELECT s.id INTO v_assigned_staff_id
    FROM staff s
    WHERE s.id = ANY(v_admin_shift_staff_ids)
      AND s.status = 'ACTIVE'
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

COMMENT ON FUNCTION public.assign_staff_to_booking IS 'Assign staff to booking based on priority: staff with ADMIN_SHIFT at booking time (then closest session time, then least future sessions), then closest session time, ADMINSTAFF availability, least future sessions';
