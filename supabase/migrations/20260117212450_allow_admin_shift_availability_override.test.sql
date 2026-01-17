-- Test script for ADMIN_SHIFT availability override migration
-- Run this after migration to verify functionality

-- Test 1: Staff with ADMIN_SHIFT should be available even without day-of-week availability
-- Setup: Create staff with ADMIN_SHIFT on Saturday but availability_saturday_am = false
DO $$
DECLARE
  v_staff_id UUID;
  v_admin_shift_id UUID;
  v_session_id UUID;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_available_staff UUID[];
BEGIN
  -- Create test staff (user_id can be NULL)
  INSERT INTO staff (id, first_name, last_name, status, trial_session_availability, availability_saturday_am, role, user_id)
  VALUES (gen_random_uuid(), 'Test', 'Staff', 'ACTIVE', true, false, 'ADMINSTAFF', NULL)
  RETURNING id INTO v_staff_id;
  
  -- Create admin shift for Saturday 9am-12pm
  INSERT INTO admin_shifts (id, day_of_week, start_time, end_time, status)
  VALUES (gen_random_uuid(), 6, '09:00', '12:00', 'ACTIVE')
  RETURNING id INTO v_admin_shift_id;
  
  -- Assign staff to admin shift
  INSERT INTO admin_shifts_staff (admin_shift_id, staff_id)
  VALUES (v_admin_shift_id, v_staff_id);
  
  -- Precreate admin shift session for next Saturday
  PERFORM precreate_admin_shift_sessions(
    v_admin_shift_id,
    CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL,
    CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL + INTERVAL '7 days'
  );
  
  -- Get the admin shift session
  SELECT id INTO v_session_id
  FROM sessions
  WHERE admin_shift_id = v_admin_shift_id
    AND EXTRACT(DOW FROM start_at AT TIME ZONE 'Australia/Adelaide') = 6
  LIMIT 1;
  
  -- Assign staff to session
  INSERT INTO sessions_staff (id, session_id, staff_id, type)
  VALUES (gen_random_uuid(), v_session_id, v_staff_id, 'MAIN_TUTOR');
  
  -- Test: Check availability for Saturday 9:30am slot
  v_slot_start := (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL)::DATE || ' 09:30:00'::TIME AT TIME ZONE 'Australia/Adelaide';
  v_slot_end := v_slot_start + INTERVAL '60 minutes';
  
  SELECT available_staff_ids INTO v_available_staff
  FROM get_available_slots(
    v_slot_start::DATE,
    v_slot_start::DATE,
    'TRIAL_SESSION'::session_type,
    NULL,
    60,
    TRUE
  )
  WHERE start_at = v_slot_start AND end_at = v_slot_end
  LIMIT 1;
  
  -- Verify staff is available despite availability_saturday_am = false
  IF v_available_staff IS NULL OR NOT (v_staff_id = ANY(v_available_staff)) THEN
    RAISE EXCEPTION 'Test 1 FAILED: Staff with ADMIN_SHIFT should be available even without day-of-week availability';
  END IF;
  
  RAISE NOTICE 'Test 1 PASSED: Staff with ADMIN_SHIFT is available despite availability_saturday_am = false';
  
  -- Cleanup
  DELETE FROM sessions_staff WHERE staff_id = v_staff_id;
  DELETE FROM sessions WHERE admin_shift_id = v_admin_shift_id;
  DELETE FROM admin_shifts_staff WHERE admin_shift_id = v_admin_shift_id;
  DELETE FROM admin_shifts WHERE id = v_admin_shift_id;
  DELETE FROM staff WHERE id = v_staff_id;
END $$;

-- Test 2: Staff with ADMIN_SHIFT but without capability flag should NOT be available
DO $$
DECLARE
  v_staff_id UUID;
  v_admin_shift_id UUID;
  v_session_id UUID;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_available_staff UUID[];
BEGIN
  -- Create test staff WITHOUT trial_session_availability
  INSERT INTO staff (id, first_name, last_name, status, trial_session_availability, availability_saturday_am, role, user_id)
  VALUES (gen_random_uuid(), 'Test', 'Staff2', 'ACTIVE', false, true, 'ADMINSTAFF', gen_random_uuid())
  RETURNING id INTO v_staff_id;
  
  -- Create admin shift for Saturday
  INSERT INTO admin_shifts (id, day_of_week, start_time, end_time, status)
  VALUES (gen_random_uuid(), 6, '09:00', '12:00', 'ACTIVE')
  RETURNING id INTO v_admin_shift_id;
  
  INSERT INTO admin_shifts_staff (admin_shift_id, staff_id)
  VALUES (v_admin_shift_id, v_staff_id);
  
  PERFORM precreate_admin_shift_sessions(
    v_admin_shift_id,
    CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL,
    CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL + INTERVAL '7 days'
  );
  
  SELECT id INTO v_session_id
  FROM sessions
  WHERE admin_shift_id = v_admin_shift_id
    AND EXTRACT(DOW FROM start_at AT TIME ZONE 'Australia/Adelaide') = 6
  LIMIT 1;
  
  INSERT INTO sessions_staff (id, session_id, staff_id, type)
  VALUES (gen_random_uuid(), v_session_id, v_staff_id, 'MAIN_TUTOR');
  
  -- Test: Check availability for TRIAL_SESSION
  v_slot_start := (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL)::DATE || ' 09:30:00'::TIME AT TIME ZONE 'Australia/Adelaide';
  v_slot_end := v_slot_start + INTERVAL '60 minutes';
  
  SELECT available_staff_ids INTO v_available_staff
  FROM get_available_slots(
    v_slot_start::DATE,
    v_slot_start::DATE,
    'TRIAL_SESSION'::session_type,
    NULL,
    60,
    TRUE
  )
  WHERE start_at = v_slot_start AND end_at = v_slot_end
  LIMIT 1;
  
  -- Verify staff is NOT available (capability flag required)
  IF v_available_staff IS NOT NULL AND v_staff_id = ANY(v_available_staff) THEN
    RAISE EXCEPTION 'Test 2 FAILED: Staff without trial_session_availability should NOT be available even with ADMIN_SHIFT';
  END IF;
  
  RAISE NOTICE 'Test 2 PASSED: Capability flags still required even with ADMIN_SHIFT';
  
  -- Cleanup
  DELETE FROM sessions_staff WHERE staff_id = v_staff_id;
  DELETE FROM sessions WHERE admin_shift_id = v_admin_shift_id;
  DELETE FROM admin_shifts_staff WHERE admin_shift_id = v_admin_shift_id;
  DELETE FROM admin_shifts WHERE id = v_admin_shift_id;
  DELETE FROM staff WHERE id = v_staff_id;
END $$;

-- Test 3: Blockout should override ADMIN_SHIFT
DO $$
DECLARE
  v_staff_id UUID;
  v_admin_shift_id UUID;
  v_session_id UUID;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_available_staff UUID[];
BEGIN
  -- Create test staff
  INSERT INTO staff (id, first_name, last_name, status, trial_session_availability, availability_saturday_am, role, user_id)
  VALUES (gen_random_uuid(), 'Test', 'Staff3', 'ACTIVE', true, true, 'ADMINSTAFF', gen_random_uuid())
  RETURNING id INTO v_staff_id;
  
  -- Create admin shift
  INSERT INTO admin_shifts (id, day_of_week, start_time, end_time, status)
  VALUES (gen_random_uuid(), 6, '09:00', '12:00', 'ACTIVE')
  RETURNING id INTO v_admin_shift_id;
  
  INSERT INTO admin_shifts_staff (admin_shift_id, staff_id)
  VALUES (v_admin_shift_id, v_staff_id);
  
  PERFORM precreate_admin_shift_sessions(
    v_admin_shift_id,
    CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL,
    CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL + INTERVAL '7 days'
  );
  
  SELECT id INTO v_session_id
  FROM sessions
  WHERE admin_shift_id = v_admin_shift_id
    AND EXTRACT(DOW FROM start_at AT TIME ZONE 'Australia/Adelaide') = 6
  LIMIT 1;
  
  INSERT INTO sessions_staff (id, session_id, staff_id, type)
  VALUES (gen_random_uuid(), v_session_id, v_staff_id, 'MAIN_TUTOR');
  
  -- Create blockout for 9:30am-10:30am slot
  v_slot_start := (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL)::DATE || ' 09:30:00'::TIME AT TIME ZONE 'Australia/Adelaide';
  v_slot_end := v_slot_start + INTERVAL '60 minutes';
  
  INSERT INTO booking_staff_unavailability (id, staff_id, start_at, end_at, reason)
  VALUES (gen_random_uuid(), v_staff_id, v_slot_start, v_slot_end, 'Test blockout');
  
  -- Test: Check availability
  SELECT available_staff_ids INTO v_available_staff
  FROM get_available_slots(
    v_slot_start::DATE,
    v_slot_start::DATE,
    'TRIAL_SESSION'::session_type,
    NULL,
    60,
    TRUE
  )
  WHERE start_at = v_slot_start AND end_at = v_slot_end
  LIMIT 1;
  
  -- Verify staff is NOT available (blockout overrides)
  IF v_available_staff IS NOT NULL AND v_staff_id = ANY(v_available_staff) THEN
    RAISE EXCEPTION 'Test 3 FAILED: Blockout should override ADMIN_SHIFT availability';
  END IF;
  
  RAISE NOTICE 'Test 3 PASSED: Blockout overrides ADMIN_SHIFT';
  
  -- Cleanup
  DELETE FROM booking_staff_unavailability WHERE staff_id = v_staff_id;
  DELETE FROM sessions_staff WHERE staff_id = v_staff_id;
  DELETE FROM sessions WHERE admin_shift_id = v_admin_shift_id;
  DELETE FROM admin_shifts_staff WHERE admin_shift_id = v_admin_shift_id;
  DELETE FROM admin_shifts WHERE id = v_admin_shift_id;
  DELETE FROM staff WHERE id = v_staff_id;
END $$;

-- Test 4: Non-ADMIN_SHIFT concurrent session should block availability
DO $$
DECLARE
  v_staff_id UUID;
  v_admin_shift_id UUID;
  v_admin_session_id UUID;
  v_other_session_id UUID;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_available_staff UUID[];
BEGIN
  -- Create test staff
  INSERT INTO staff (id, first_name, last_name, status, trial_session_availability, availability_saturday_am, role, user_id)
  VALUES (gen_random_uuid(), 'Test', 'Staff4', 'ACTIVE', true, true, 'ADMINSTAFF', gen_random_uuid())
  RETURNING id INTO v_staff_id;
  
  -- Create admin shift 9am-12pm
  INSERT INTO admin_shifts (id, day_of_week, start_time, end_time, status)
  VALUES (gen_random_uuid(), 6, '09:00', '12:00', 'ACTIVE')
  RETURNING id INTO v_admin_shift_id;
  
  INSERT INTO admin_shifts_staff (admin_shift_id, staff_id)
  VALUES (v_admin_shift_id, v_staff_id);
  
  PERFORM precreate_admin_shift_sessions(
    v_admin_shift_id,
    CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL,
    CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL + INTERVAL '7 days'
  );
  
  SELECT id INTO v_admin_session_id
  FROM sessions
  WHERE admin_shift_id = v_admin_shift_id
    AND EXTRACT(DOW FROM start_at AT TIME ZONE 'Australia/Adelaide') = 6
  LIMIT 1;
  
  INSERT INTO sessions_staff (id, session_id, staff_id, type)
  VALUES (gen_random_uuid(), v_admin_session_id, v_staff_id, 'MAIN_TUTOR');
  
  -- Create concurrent DRAFTING session 10am-11am
  v_slot_start := (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL)::DATE || ' 10:00:00'::TIME AT TIME ZONE 'Australia/Adelaide';
  v_slot_end := v_slot_start + INTERVAL '60 minutes';
  
  INSERT INTO sessions (id, type, start_at, end_at, status)
  VALUES (gen_random_uuid(), 'DRAFTING', v_slot_start, v_slot_end, 'ACTIVE')
  RETURNING id INTO v_other_session_id;
  
  INSERT INTO sessions_staff (id, session_id, staff_id, type)
  VALUES (gen_random_uuid(), v_other_session_id, v_staff_id, 'MAIN_TUTOR');
  
  -- Test: Check availability for 10:00am-11:00am slot (should be blocked)
  SELECT available_staff_ids INTO v_available_staff
  FROM get_available_slots(
    v_slot_start::DATE,
    v_slot_start::DATE,
    'TRIAL_SESSION'::session_type,
    NULL,
    60,
    TRUE
  )
  WHERE start_at = v_slot_start AND end_at = v_slot_end
  LIMIT 1;
  
  -- Verify staff is NOT available (concurrent non-ADMIN_SHIFT session blocks)
  IF v_available_staff IS NOT NULL AND v_staff_id = ANY(v_available_staff) THEN
    RAISE EXCEPTION 'Test 4 FAILED: Concurrent non-ADMIN_SHIFT session should block availability';
  END IF;
  
  -- Test: Check availability for 9:30am-10:30am slot (should be available, only partially overlaps)
  v_slot_start := (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL)::DATE || ' 09:30:00'::TIME AT TIME ZONE 'Australia/Adelaide';
  v_slot_end := v_slot_start + INTERVAL '60 minutes';
  
  SELECT available_staff_ids INTO v_available_staff
  FROM get_available_slots(
    v_slot_start::DATE,
    v_slot_start::DATE,
    'TRIAL_SESSION'::session_type,
    NULL,
    60,
    TRUE
  )
  WHERE start_at = v_slot_start AND end_at = v_slot_end
  LIMIT 1;
  
  -- This slot overlaps with the concurrent session, so should be blocked
  IF v_available_staff IS NOT NULL AND v_staff_id = ANY(v_available_staff) THEN
    RAISE EXCEPTION 'Test 4 FAILED: Slot overlapping concurrent session should be blocked';
  END IF;
  
  -- Test: Check availability for 9:00am-10:00am slot (should be available, no overlap)
  v_slot_start := (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::INTEGER || ' days'::INTERVAL)::DATE || ' 09:00:00'::TIME AT TIME ZONE 'Australia/Adelaide';
  v_slot_end := v_slot_start + INTERVAL '60 minutes';
  
  SELECT available_staff_ids INTO v_available_staff
  FROM get_available_slots(
    v_slot_start::DATE,
    v_slot_start::DATE,
    'TRIAL_SESSION'::session_type,
    NULL,
    60,
    TRUE
  )
  WHERE start_at = v_slot_start AND end_at = v_slot_end
  LIMIT 1;
  
  -- Verify staff IS available (no overlap with concurrent session)
  IF v_available_staff IS NULL OR NOT (v_staff_id = ANY(v_available_staff)) THEN
    RAISE EXCEPTION 'Test 4 FAILED: Staff should be available for non-overlapping slot during ADMIN_SHIFT';
  END IF;
  
  RAISE NOTICE 'Test 4 PASSED: Concurrent non-ADMIN_SHIFT sessions block availability correctly';
  
  -- Cleanup
  DELETE FROM sessions_staff WHERE staff_id = v_staff_id;
  DELETE FROM sessions WHERE id IN (v_admin_session_id, v_other_session_id);
  DELETE FROM admin_shifts_staff WHERE admin_shift_id = v_admin_shift_id;
  DELETE FROM admin_shifts WHERE id = v_admin_shift_id;
  DELETE FROM staff WHERE id = v_staff_id;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'All tests completed successfully!';
END $$;
