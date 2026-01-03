# Booking System E2E Testing Guide

This guide provides step-by-step instructions for end-to-end testing of the booking system (ALTI-6 and ALTI-19).

## Prerequisites

1. **Database Setup**
   ```bash
   # Apply all migrations
   cd supabase
   supabase db reset  # or apply migrations manually
   ```

2. **Environment Variables**
   - Ensure all apps have proper Supabase credentials configured
   - Verify timezone settings (system uses Australia/Adelaide)

3. **Test Data**
   - At least one staff member with availability flags set
   - At least one student with subjects assigned
   - Opening hours configured

## Part 1: ALTI-6 - Availability & Settings Testing

### 1.1 Opening Hours Configuration

**Admin Web** (`http://localhost:3000/settings/opening-hours`)

1. **Create Opening Hours**
   - Navigate to Settings → Opening Hours
   - Click "Add Opening Hours"
   - Set up hours for each day of the week (e.g., Monday-Friday 9:00 AM - 5:00 PM)
   - Verify hours are saved and displayed correctly

2. **Edit Opening Hours**
   - Click edit on an existing day
   - Modify start/end times
   - Verify changes are saved

3. **Deactivate Opening Hours**
   - Toggle `is_active` to false for a day
   - Verify that day shows as inactive
   - Verify availability calculations exclude inactive days

**Database Verification:**
```sql
SELECT * FROM opening_hours ORDER BY day_of_week;
SELECT * FROM vopening_hours; -- Should only show active hours
```

### 1.2 Blockout Dates

**Admin Web** (`http://localhost:3000/settings/blockouts`)

1. **Create Staff Blockout (Admin)**
   - Navigate to Settings → Blockout Dates
   - Click "Add Blockout"
   - Select a staff member
   - Set start and end date/time (in Adelaide timezone)
   - Add optional reason
   - Verify blockout appears in the table

2. **Edit Blockout**
   - Click edit on an existing blockout
   - Modify dates or reason
   - Verify changes are saved

3. **Delete Blockout**
   - Click delete on a blockout
   - Confirm deletion
   - Verify blockout is removed

**Tutor Web** (`http://localhost:3002/settings/blockouts`)

1. **Create Own Blockout (Tutor)**
   - Login as a tutor
   - Navigate to Settings → Blockout Dates
   - Click "Add Blockout"
   - Set dates (should only show current tutor, no selection needed)
   - Verify blockout is created

2. **Verify RLS**
   - Tutor should only see their own blockouts
   - Tutor cannot see other tutors' blockouts

**Database Verification:**
```sql
SELECT * FROM booking_staff_unavailability ORDER BY start_at;
SELECT * FROM vtutor_blockouts; -- Should only show current tutor's blockouts
```

### 1.3 Booking Settings

**Admin Web** (via database or API)

1. **View Settings**
   ```sql
   SELECT * FROM booking_settings;
   SELECT * FROM vbooking_settings;
   ```

2. **Update Settings**
   ```sql
   UPDATE booking_settings 
   SET setting_value = '30', updated_at = NOW() 
   WHERE setting_key = 'slot_duration_minutes';
   ```

3. **Verify Default Settings Exist**
   - `slot_duration_minutes` (default: 15)
   - `booking_buffer_minutes` (default: 0)
   - `advance_booking_days` (default: 30)
   - `booking_padding_minutes` (default: 0)

### 1.4 Staff Availability Flags

**Database Setup:**

1. **Set Staff Availability**
   ```sql
   -- Set day-of-week availability
   UPDATE staff 
   SET 
     availability_monday = true,
     availability_tuesday = true,
     availability_wednesday = true,
     availability_thursday = true,
     availability_friday = true,
     drafting_availability = true,
     trial_session_availability = true,
     subsidy_interview_availability = true
   WHERE id = '<staff_id>';
   ```

2. **Verify Availability View**
   ```sql
   SELECT * FROM vstaff_availability_summary WHERE id = '<staff_id>';
   ```

## Part 2: ALTI-19 - Booking System Testing

### 2.1 Student-Web Booking Flow

**Student Web** (`http://localhost:3001`)

#### Test Case 1: Drafting Session Booking

1. **Login as Student**
   - Navigate to student portal
   - Login with student credentials

2. **Navigate to Booking Page**
   - Go to `/book-drafting`
   - Verify page loads with booking flow

3. **Step 1: Select Subject**
   - Verify student's subjects are displayed
   - Select a subject
   - Click continue

4. **Step 2: Select Time Slot**
   - Verify calendar shows available slots
   - Verify slots respect:
     - Opening hours
     - Staff availability
     - Blockout dates
     - Existing sessions
   - Select an available time slot
   - Verify reservation is created (10-minute expiry)

5. **Step 3: Confirm Booking**
   - Review booking details
   - Click "Confirm Booking"
   - Verify success message
   - Verify redirect to session page
   - Verify session is created in database

**Database Verification:**
```sql
-- Check session was created
SELECT * FROM sessions WHERE type = 'DRAFTING' ORDER BY created_at DESC LIMIT 1;

-- Check staff was assigned
SELECT s.*, ss.staff_id 
FROM sessions s
JOIN sessions_staff ss ON ss.session_id = s.id
WHERE s.type = 'DRAFTING'
ORDER BY s.created_at DESC LIMIT 1;

-- Check reservation was consumed
SELECT * FROM slot_reservations WHERE expires_at > NOW(); -- Should not include the booked slot
```

#### Test Case 2: Trial Session Booking

1. **Navigate to `/booking/trial-session`**
   - Verify page loads

2. **Step 1: Select Subject (Optional)**
   - Optionally select a subject
   - Or skip to next step

3. **Step 2: Select Time Slot**
   - Select available slot
   - Verify reservation created

4. **Step 3: Confirm Booking**
   - Complete booking
   - Verify session created with type `TRIAL_SESSION`

### 2.2 Admin-Web Booking Flow

**Admin Web** (`http://localhost:3000`)

#### Test Case 3: Admin Creates Drafting Session

1. **Open Booking Modal**
   - Navigate to sessions page or wherever modal is triggered
   - Click "Book Drafting Session" (or similar button)
   - Verify `BookSessionModal` opens

2. **Step 1: Select Student**
   - Type student name in search
   - Verify search results appear (after 2+ characters)
   - Select a student
   - Verify step advances

3. **Step 2: Select Subject**
   - Verify student's subjects are shown
   - Select a subject
   - Click "Continue to Time Selection"

4. **Step 3: Select Time Slot**
   - Verify available slots displayed
   - Select a slot
   - Verify step advances

5. **Step 4: Confirm Booking**
   - Review booking details
   - Click "Create Booking"
   - Verify success message
   - Verify modal closes
   - Verify session appears in sessions list

#### Test Case 4: Admin Creates Trial Session

1. **Open Booking Modal** with `sessionType="TRIAL_SESSION"`
2. **Select Student**
3. **Select Subject (Optional)** - Can skip
4. **Select Time Slot**
5. **Confirm Booking**
6. **Verify** session created with type `TRIAL_SESSION`

#### Test Case 5: Admin Creates Subsidy Interview

1. **Open Booking Modal** with `sessionType="SUBSIDY_INTERVIEW"`
2. **Follow same flow as Trial Session**
3. **Verify** session created with type `SUBSIDY_INTERVIEW`

### 2.3 Availability Calculation Testing

**Test Availability Function Directly:**

```sql
-- Test basic availability
SELECT * FROM get_available_slots(
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  'DRAFTING'::public.session_type,
  NULL, -- subject_id
  60    -- duration_minutes
);

-- Test with subject filter
SELECT * FROM get_available_slots(
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  'DRAFTING'::public.session_type,
  '<subject_id>'::UUID,
  60
);

-- Test different session types
SELECT * FROM get_available_slots(
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  'TRIAL_SESSION'::public.session_type,
  NULL,
  60
);
```

**Verify Availability Logic:**
1. **Opening Hours**: Slots should only appear during configured hours
2. **Staff Availability**: Only staff with appropriate flags should be available
3. **Blockouts**: Slots overlapping blockouts should be unavailable
4. **Existing Sessions**: Slots overlapping existing sessions should be unavailable
5. **Reservations**: Active reservations should block slots
6. **Subject Match**: For drafting, only staff with matching subject should appear

### 2.4 Staff Assignment Testing

**Test Assignment Function:**

```sql
-- Test auto-assignment
SELECT assign_staff_to_booking(
  'DRAFTING'::public.session_type,
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
  ARRAY['<staff_id_1>'::UUID, '<staff_id_2>'::UUID],
  '<subject_id>'::UUID
);
```

**Verify Assignment Priority:**
1. Staff with subject match (for drafting)
2. Staff with fewest existing sessions
3. Staff availability flags
4. Random selection if tie

### 2.5 Reservation System Testing

**Test Reservation Flow:**

1. **Create Reservation**
   ```sql
   INSERT INTO slot_reservations (
     start_at, end_at, session_type, subject_id, reserved_by
   ) VALUES (
     NOW() + INTERVAL '1 day',
     NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
     'DRAFTING'::public.session_type,
     '<subject_id>'::UUID,
     '<user_id>'::UUID
   );
   ```

2. **Verify Reservation Blocks Availability**
   - Check `get_available_slots` excludes reserved slot
   - Verify reservation expires after 10 minutes

3. **Test Reservation Cleanup**
   ```sql
   -- Create expired reservation
   INSERT INTO slot_reservations (
     start_at, end_at, session_type, expires_at
   ) VALUES (
     NOW() + INTERVAL '1 day',
     NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
     'DRAFTING'::public.session_type,
     NOW() - INTERVAL '1 minute' -- Already expired
   );
   
   -- Call get_available_slots (should cleanup expired)
   SELECT * FROM get_available_slots(
     CURRENT_DATE,
     CURRENT_DATE + INTERVAL '7 days',
     'DRAFTING'::public.session_type
   );
   
   -- Verify expired reservation was deleted
   SELECT * FROM slot_reservations WHERE expires_at <= NOW(); -- Should be empty
   ```

4. **Convert Reservation to Session**
   - Create booking with `reservation_id`
   - Verify reservation is consumed (deleted)
   - Verify session is created

### 2.6 Edge Cases & Error Handling

#### Test Case 6: No Available Slots

1. **Setup**: Block all staff for a day
2. **Test**: Query availability for that day
3. **Expected**: No slots returned

#### Test Case 7: Expired Reservation

1. **Setup**: Create reservation, wait 10+ minutes
2. **Test**: Try to create booking with expired reservation
3. **Expected**: Error message, reservation not found

#### Test Case 8: Double Booking Prevention

1. **Setup**: Create session for a time slot
2. **Test**: Try to create another session for same slot
3. **Expected**: Slot not available in availability query

#### Test Case 9: Subject Mismatch

1. **Setup**: Staff without subject assignment
2. **Test**: Query availability for drafting with subject
3. **Expected**: Staff not in available_staff_ids

#### Test Case 10: Timezone Handling

1. **Setup**: Create booking for specific Adelaide time
2. **Test**: Verify times stored correctly in UTC
3. **Test**: Verify times displayed correctly in Adelaide timezone
4. **Expected**: Correct conversion both ways

## Part 3: Integration Testing

### 3.1 Full Booking Flow

1. **Setup Complete Environment**
   - Opening hours: Mon-Fri 9am-5pm
   - Staff availability: Multiple staff with different subjects
   - Student with subjects assigned

2. **Execute Full Flow**
   - Student books drafting session
   - Admin books trial session
   - Admin books subsidy interview
   - Tutor creates blockout
   - Verify all bookings respect constraints

3. **Verify Data Integrity**
   - All sessions have assigned staff
   - All sessions have correct types
   - No double bookings
   - Reservations cleaned up

### 3.2 RLS Policy Testing

**Test Access Control:**

1. **AdminStaff**
   - Full access to all tables
   - Can create/edit/delete opening hours
   - Can create/edit/delete blockouts for any staff
   - Can view all bookings

2. **Tutor**
   - Read-only access via views
   - Can create/edit/delete own blockouts via API
   - Cannot access other tutors' data directly

3. **Student**
   - Read-only access via views
   - Can create bookings via API
   - Cannot access other students' data

**Test Queries:**
```sql
-- As AdminStaff (should work)
SELECT * FROM opening_hours;
SELECT * FROM booking_staff_unavailability;
SELECT * FROM booking_settings;

-- As Tutor (should work via views)
SELECT * FROM vopening_hours;
SELECT * FROM vtutor_blockouts;
SELECT * FROM vbooking_settings;

-- As Student (should work via views)
SELECT * FROM vopening_hours;
SELECT * FROM vbooking_settings;
```

## Part 4: Performance Testing

### 4.1 Availability Query Performance

```sql
-- Test with large date range
EXPLAIN ANALYZE
SELECT * FROM get_available_slots(
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '90 days',
  'DRAFTING'::public.session_type
);

-- Should complete in < 1 second
```

### 4.2 Index Verification

```sql
-- Verify indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('slot_reservations', 'booking_staff_unavailability', 'opening_hours')
ORDER BY tablename, indexname;
```

## Part 5: UI/UX Testing

### 5.1 Student-Web UI

1. **Booking Flow**
   - Verify step indicator shows progress
   - Verify back button works
   - Verify form validation
   - Verify loading states
   - Verify error messages

2. **TimeSlotPicker**
   - Verify calendar navigation (prev/next week)
   - Verify slot selection
   - Verify disabled slots (unavailable)
   - Verify selected slot highlighting
   - Verify timezone display

### 5.2 Admin-Web UI

1. **Booking Modal**
   - Verify student search
   - Verify subject selection
   - Verify time slot picker
   - Verify confirmation step
   - Verify success/error handling

2. **Settings Pages**
   - Verify opening hours table
   - Verify blockout dates table
   - Verify CRUD operations
   - Verify timezone handling

## Troubleshooting

### Common Issues

1. **No Available Slots**
   - Check opening hours are configured
   - Check staff availability flags
   - Check for blockouts
   - Check existing sessions

2. **Reservations Not Expiring**
   - Verify `get_available_slots` is being called (triggers cleanup)
   - Check `expires_at` timestamps
   - Manually run `cleanup_expired_reservations()`

3. **Timezone Issues**
   - Verify client sends times in correct format
   - Check database stores UTC
   - Verify display converts to Adelaide time

4. **RLS Policy Errors**
   - Verify user role (AdminStaff vs Tutor vs Student)
   - Check using views for read access
   - Check using API routes for write access

### Debug Queries

```sql
-- Check current user context
SELECT auth.uid(), current_tutor_id(), current_student_id();

-- Check staff availability
SELECT * FROM vstaff_availability_summary;

-- Check active reservations
SELECT * FROM slot_reservations WHERE expires_at > NOW();

-- Check recent bookings
SELECT * FROM sessions 
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

## Success Criteria

✅ All migrations applied successfully  
✅ Opening hours can be configured  
✅ Blockout dates can be created/edited/deleted  
✅ Booking settings are accessible  
✅ Students can book drafting and trial sessions  
✅ Admins can book all session types  
✅ Availability calculations respect all constraints  
✅ Staff assignment works correctly  
✅ Reservations expire and cleanup automatically  
✅ RLS policies enforce correct access control  
✅ UI components work smoothly  
✅ No double bookings occur  
✅ Timezone handling is correct  

## Next Steps

After successful E2E testing:
1. Test notification integration (SMS/Email)
2. Load testing with multiple concurrent bookings
3. User acceptance testing with real users
4. Performance optimization if needed

