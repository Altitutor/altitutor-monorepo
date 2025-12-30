-- Migration: Booking Availability System (ALTI-6)
-- Description:
--   - Create booking_staff_unavailability table for blockout dates
--   - Create opening_hours table for business hours
--   - Add session-type availability columns to staff table
--   - Create booking_settings table for global booking configuration
--   - Set up RLS policies for AdminStaff and Tutor access

-- ========================
-- 1. CREATE BOOKING_STAFF_UNAVAILABILITY TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.booking_staff_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  CONSTRAINT booking_staff_unavailability_valid_range CHECK (end_at > start_at)
);

-- Indexes for availability queries
CREATE INDEX IF NOT EXISTS idx_booking_staff_unavailability_staff_range 
  ON public.booking_staff_unavailability(staff_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_booking_staff_unavailability_range 
  ON public.booking_staff_unavailability USING GIST (staff_id, tstzrange(start_at, end_at));

-- Comments
COMMENT ON TABLE public.booking_staff_unavailability IS 'Staff blockout dates and times when they are unavailable for bookings';
COMMENT ON COLUMN public.booking_staff_unavailability.reason IS 'Optional reason for the unavailability (e.g., "Holiday", "Sick leave")';

-- ========================
-- 2. CREATE OPENING_HOURS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL, -- e.g., '09:00'
  end_time TIME NOT NULL, -- e.g., '17:00'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT opening_hours_unique_day UNIQUE(day_of_week),
  CONSTRAINT opening_hours_valid_time CHECK (end_time > start_time)
);

-- Comments
COMMENT ON TABLE public.opening_hours IS 'Business opening hours by day of week (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN public.opening_hours.day_of_week IS 'Postgres DOW: 0=Sunday, 1=Monday, ..., 6=Saturday';

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_opening_hours ON public.opening_hours;
CREATE TRIGGER set_updated_at_opening_hours
BEFORE UPDATE ON public.opening_hours
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- 3. ADD SESSION-TYPE AVAILABILITY COLUMNS TO STAFF TABLE
-- ========================
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS drafting_availability BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_session_availability BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subsidy_interview_availability BOOLEAN DEFAULT FALSE;

-- Comments
COMMENT ON COLUMN public.staff.drafting_availability IS 'Whether staff member is available for drafting sessions';
COMMENT ON COLUMN public.staff.trial_session_availability IS 'Whether staff member is available for trial sessions';
COMMENT ON COLUMN public.staff.subsidy_interview_availability IS 'Whether staff member is available for subsidy interviews';

-- ========================
-- 4. CREATE BOOKING_SETTINGS TABLE (key-value pattern like billing_settings)
-- ========================
CREATE TABLE IF NOT EXISTS public.booking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_booking_settings ON public.booking_settings;
CREATE TRIGGER set_updated_at_booking_settings
BEFORE UPDATE ON public.booking_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert default booking settings
INSERT INTO public.booking_settings (setting_key, setting_value, description) VALUES
  ('trial_session_duration_minutes', '45', 'Default duration for trial sessions in minutes'),
  ('drafting_session_duration_minutes', '60', 'Default duration for drafting sessions in minutes'),
  ('subsidy_interview_duration_minutes', '45', 'Default duration for subsidy interviews in minutes'),
  ('min_advance_booking_days', '1', 'Minimum days in advance bookings can be made'),
  ('max_advance_booking_days', '90', 'Maximum days in advance bookings can be made'),
  ('slot_duration_minutes', '15', 'Time slot granularity for booking calendar in minutes'),
  ('booking_buffer_minutes', '15', 'Minimum buffer time between bookings in minutes')
ON CONFLICT (setting_key) DO NOTHING;

-- Comments
COMMENT ON TABLE public.booking_settings IS 'Global booking configuration settings (key-value pairs)';

-- ========================
-- 5. RLS POLICIES
-- ========================

-- booking_staff_unavailability: AdminStaff full access, Tutors can manage own
ALTER TABLE public.booking_staff_unavailability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to booking_staff_unavailability" ON public.booking_staff_unavailability;
CREATE POLICY "ADMINSTAFF full access to booking_staff_unavailability" ON public.booking_staff_unavailability
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

DROP POLICY IF EXISTS "Tutors can read own unavailability" ON public.booking_staff_unavailability;
CREATE POLICY "Tutors can read own unavailability" ON public.booking_staff_unavailability
  FOR SELECT TO authenticated
  USING (
    staff_id = public.current_staff_id()
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = public.current_staff_id()
        AND s.role IN ('TUTOR', 'ADMINSTAFF')
        AND s.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Tutors can create own unavailability" ON public.booking_staff_unavailability;
CREATE POLICY "Tutors can create own unavailability" ON public.booking_staff_unavailability
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_id = public.current_staff_id()
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = public.current_staff_id()
        AND s.role IN ('TUTOR', 'ADMINSTAFF')
        AND s.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Tutors can update own unavailability" ON public.booking_staff_unavailability;
CREATE POLICY "Tutors can update own unavailability" ON public.booking_staff_unavailability
  FOR UPDATE TO authenticated
  USING (
    staff_id = public.current_staff_id()
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = public.current_staff_id()
        AND s.role IN ('TUTOR', 'ADMINSTAFF')
        AND s.status = 'ACTIVE'
    )
  )
  WITH CHECK (
    staff_id = public.current_staff_id()
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = public.current_staff_id()
        AND s.role IN ('TUTOR', 'ADMINSTAFF')
        AND s.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Tutors can delete own unavailability" ON public.booking_staff_unavailability;
CREATE POLICY "Tutors can delete own unavailability" ON public.booking_staff_unavailability
  FOR DELETE TO authenticated
  USING (
    staff_id = public.current_staff_id()
    AND EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = public.current_staff_id()
        AND s.role IN ('TUTOR', 'ADMINSTAFF')
        AND s.status = 'ACTIVE'
    )
  );

-- opening_hours: AdminStaff only
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to opening_hours" ON public.opening_hours;
CREATE POLICY "ADMINSTAFF full access to opening_hours" ON public.opening_hours
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- booking_settings: AdminStaff only
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to booking_settings" ON public.booking_settings;
CREATE POLICY "ADMINSTAFF full access to booking_settings" ON public.booking_settings
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ========================
-- 6. GRANTS
-- ========================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_staff_unavailability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_settings TO authenticated;

