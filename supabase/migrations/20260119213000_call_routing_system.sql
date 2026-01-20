-- Migration: Call Routing System (ALTI-21)
-- Description:
--   - Create call_routing_rules table for priority-based call routing
--   - Create on_call_schedules table for staff on-call schedules
--   - Set up RLS policies for AdminStaff access
--   - Add indexes for efficient querying

-- ========================
-- 1. CREATE CALL_ROUTING_RULES TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.call_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owned_number_id UUID NOT NULL REFERENCES public.owned_numbers(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('BUSINESS_HOURS', 'ON_CALL', 'DEFAULT')),
  priority INTEGER NOT NULL DEFAULT 0, -- Lower number = higher priority
  
  -- For BUSINESS_HOURS rule:
  forward_to_phone TEXT, -- E164 phone number (e.g., '+61468064000')
  
  -- For DEFAULT rule:
  message_type TEXT CHECK (message_type IN ('TTS', 'AUDIO')) DEFAULT 'TTS',
  message_text TEXT, -- Text-to-speech message
  audio_url TEXT, -- URL to prerecorded audio file (Twilio hosted or external)
  
  -- Common fields:
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_call_routing_rules_lookup 
  ON public.call_routing_rules(owned_number_id, is_active, priority);

-- Comments
COMMENT ON TABLE public.call_routing_rules IS 'Call routing rules with priority-based ordering for Twilio voice calls';
COMMENT ON COLUMN public.call_routing_rules.priority IS 'Lower number = higher priority. BUSINESS_HOURS (0) > ON_CALL (50) > DEFAULT (100)';
COMMENT ON COLUMN public.call_routing_rules.forward_to_phone IS 'E164 phone number to forward calls to (for BUSINESS_HOURS rule)';
COMMENT ON COLUMN public.call_routing_rules.message_type IS 'TTS for text-to-speech, AUDIO for prerecorded audio file (for DEFAULT rule)';

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_call_routing_rules ON public.call_routing_rules;
CREATE TRIGGER set_updated_at_call_routing_rules
BEFORE UPDATE ON public.call_routing_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- 2. CREATE ON_CALL_SCHEDULES TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.on_call_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL, -- e.g., '18:00'
  end_time TIME NOT NULL, -- e.g., '22:00'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT on_call_schedules_valid_time CHECK (end_time > start_time)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_on_call_schedules_lookup 
  ON public.on_call_schedules(day_of_week, is_active, start_time, end_time)
  WHERE is_active = true;

-- Index for staff lookup
CREATE INDEX IF NOT EXISTS idx_on_call_schedules_staff 
  ON public.on_call_schedules(staff_id, is_active);

-- Comments
COMMENT ON TABLE public.on_call_schedules IS 'Recurring weekly on-call schedules for staff members';
COMMENT ON COLUMN public.on_call_schedules.day_of_week IS 'Postgres DOW: 0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN public.on_call_schedules.start_time IS 'Start time for on-call period (HH:MM format)';
COMMENT ON COLUMN public.on_call_schedules.end_time IS 'End time for on-call period (HH:MM format)';

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_on_call_schedules ON public.on_call_schedules;
CREATE TRIGGER set_updated_at_on_call_schedules
BEFORE UPDATE ON public.on_call_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- 3. RLS POLICIES
-- ========================

-- call_routing_rules: AdminStaff only
ALTER TABLE public.call_routing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to call_routing_rules" ON public.call_routing_rules;
CREATE POLICY "ADMINSTAFF full access to call_routing_rules" 
  ON public.call_routing_rules
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- on_call_schedules: AdminStaff only
ALTER TABLE public.on_call_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to on_call_schedules" ON public.on_call_schedules;
CREATE POLICY "ADMINSTAFF full access to on_call_schedules" 
  ON public.on_call_schedules
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ========================
-- 4. GRANTS
-- ========================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_routing_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.on_call_schedules TO authenticated;
