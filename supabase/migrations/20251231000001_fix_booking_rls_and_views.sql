-- Migration: Fix Booking RLS and Create Views (ALTI-6)
-- Description:
--   - Remove tutor direct access RLS policies (tutors should use API routes)
--   - Create views for tutors/students to read availability data
--   - Follow existing pattern: AdminStaff full access, others read through views

-- ========================
-- 1. FIX RLS POLICIES - REMOVE TUTOR DIRECT ACCESS
-- ========================

-- Remove all tutor-specific policies from booking_staff_unavailability
DROP POLICY IF EXISTS "Tutors can read own unavailability" ON public.booking_staff_unavailability;
DROP POLICY IF EXISTS "Tutors can create own unavailability" ON public.booking_staff_unavailability;
DROP POLICY IF EXISTS "Tutors can update own unavailability" ON public.booking_staff_unavailability;
DROP POLICY IF EXISTS "Tutors can delete own unavailability" ON public.booking_staff_unavailability;

-- Ensure only AdminStaff has access (already exists, but ensure it's correct)
DROP POLICY IF EXISTS "ADMINSTAFF full access to booking_staff_unavailability" ON public.booking_staff_unavailability;
CREATE POLICY "ADMINSTAFF full access to booking_staff_unavailability" ON public.booking_staff_unavailability
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ========================
-- 2. CREATE VIEWS FOR TUTORS/STUDENTS TO READ AVAILABILITY DATA
-- ========================

-- View for tutors to see their own blockouts
CREATE OR REPLACE VIEW public.vtutor_blockouts
WITH (security_invoker = false)
AS
SELECT 
  id,
  staff_id,
  start_at,
  end_at,
  reason,
  created_at,
  created_by
FROM public.booking_staff_unavailability
WHERE staff_id = public.current_staff_id();

GRANT SELECT ON public.vtutor_blockouts TO authenticated;

-- View for tutors/students to read opening hours (read-only)
CREATE OR REPLACE VIEW public.vopening_hours
WITH (security_invoker = false)
AS
SELECT 
  id,
  day_of_week,
  start_time,
  end_time,
  is_active,
  created_at,
  updated_at
FROM public.opening_hours
WHERE is_active = true;

GRANT SELECT ON public.vopening_hours TO authenticated;

-- View for tutors/students to read booking settings (read-only, for UI display)
CREATE OR REPLACE VIEW public.vbooking_settings
WITH (security_invoker = false)
AS
SELECT 
  setting_key,
  setting_value,
  description,
  updated_at
FROM public.booking_settings;

GRANT SELECT ON public.vbooking_settings TO authenticated;

-- ========================
-- 3. CREATE AVAILABILITY VIEW FOR EASIER QUERYING
-- ========================
-- This view combines opening hours, staff availability flags, and blockouts
-- to make availability queries simpler. Note: This doesn't include existing sessions
-- (that will be handled in availability functions for ALTI-19)

CREATE OR REPLACE VIEW public.vstaff_availability_summary
WITH (security_invoker = false)
AS
SELECT 
  s.id AS staff_id,
  s.first_name,
  s.last_name,
  s.role,
  s.status,
  -- Day-of-week availability flags
  s.availability_monday,
  s.availability_tuesday,
  s.availability_wednesday,
  s.availability_thursday,
  s.availability_friday,
  s.availability_saturday_am,
  s.availability_saturday_pm,
  s.availability_sunday_am,
  s.availability_sunday_pm,
  -- Session-type availability flags
  s.drafting_availability,
  s.trial_session_availability,
  s.subsidy_interview_availability,
  -- Count of active blockouts (for reference)
  COALESCE(blockout_counts.blockout_count, 0) AS active_blockout_count
FROM public.staff s
LEFT JOIN (
  SELECT 
    staff_id,
    COUNT(*) AS blockout_count
  FROM public.booking_staff_unavailability
  WHERE end_at > NOW()
  GROUP BY staff_id
) blockout_counts ON blockout_counts.staff_id = s.id
WHERE s.status = 'ACTIVE';

GRANT SELECT ON public.vstaff_availability_summary TO authenticated;

-- ========================
-- COMMENTS
-- ========================
COMMENT ON VIEW public.vtutor_blockouts IS 'Tutors can see their own blockout dates (read-only through view)';
COMMENT ON VIEW public.vopening_hours IS 'Active opening hours (read-only for tutors/students)';
COMMENT ON VIEW public.vbooking_settings IS 'Booking settings (read-only for tutors/students)';
COMMENT ON VIEW public.vstaff_availability_summary IS 'Summary of staff availability including day-of-week flags, session-type flags, and blockout counts';

