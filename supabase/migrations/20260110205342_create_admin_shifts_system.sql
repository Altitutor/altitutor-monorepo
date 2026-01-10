-- Migration: Create Admin Shifts System
-- Description:
--   - Create admin_shifts table for recurring weekly admin staff shifts
--   - Create admin_shifts_staff table for staff assignments to shifts
--   - Extend sessions table with admin_shift_id and ADMIN_SHIFT type
--   - Create precreate_admin_shift_sessions function (mirrors precreate_sessions)
--   - Create trigger functions to sync sessions when admin shifts change
--   - Create trigger functions to sync staff assignments to sessions
--   - Add RLS policies for admin_shifts tables
--   - Add activity events triggers for admin_shifts
-- Related Issue: ALTI-69

-- ========================
-- CREATE ADMIN_SHIFTS TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.admin_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL, -- e.g., "09:00" (actual shift start)
  end_time TEXT NOT NULL, -- e.g., "12:30" (actual shift end, 3.5 hours total)
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  session_start_date DATE, -- Optional: delay session creation
  session_end_date DATE, -- Optional: end session creation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id)
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_admin_shifts_day_of_week ON public.admin_shifts(day_of_week);
CREATE INDEX IF NOT EXISTS idx_admin_shifts_status ON public.admin_shifts(status);
CREATE INDEX IF NOT EXISTS idx_admin_shifts_created_by ON public.admin_shifts(created_by);

-- Enable RLS
ALTER TABLE public.admin_shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: ADMINSTAFF only
DROP POLICY IF EXISTS "ADMINSTAFF full access to admin_shifts" ON public.admin_shifts;
CREATE POLICY "ADMINSTAFF full access to admin_shifts" ON public.admin_shifts
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_admin_shifts ON public.admin_shifts;
CREATE TRIGGER set_updated_at_admin_shifts
BEFORE UPDATE ON public.admin_shifts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- CREATE ADMIN_SHIFTS_STAFF TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.admin_shifts_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_shift_id UUID NOT NULL REFERENCES public.admin_shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ, -- NULL = currently assigned
  created_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_admin_shifts_staff_admin_shift_id ON public.admin_shifts_staff(admin_shift_id);
CREATE INDEX IF NOT EXISTS idx_admin_shifts_staff_staff_id ON public.admin_shifts_staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_admin_shifts_staff_assigned_at ON public.admin_shifts_staff(admin_shift_id, assigned_at);
CREATE INDEX IF NOT EXISTS idx_admin_shifts_staff_active ON public.admin_shifts_staff(admin_shift_id) WHERE unassigned_at IS NULL;

-- Partial unique index to prevent duplicate active assignments
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_shifts_staff_unique_active 
  ON public.admin_shifts_staff(admin_shift_id, staff_id) 
  WHERE unassigned_at IS NULL;

-- Enable RLS
ALTER TABLE public.admin_shifts_staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies: ADMINSTAFF only
DROP POLICY IF EXISTS "ADMINSTAFF full access to admin_shifts_staff" ON public.admin_shifts_staff;
CREATE POLICY "ADMINSTAFF full access to admin_shifts_staff" ON public.admin_shifts_staff
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_admin_shifts_staff ON public.admin_shifts_staff;
CREATE TRIGGER set_updated_at_admin_shifts_staff
BEFORE UPDATE ON public.admin_shifts_staff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- EXTEND SESSIONS TABLE
-- ========================

-- Add ADMIN_SHIFT to session_type enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ADMIN_SHIFT' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'session_type')
  ) THEN
    ALTER TYPE public.session_type ADD VALUE 'ADMIN_SHIFT';
  END IF;
END $$;

-- Add admin_shift_id column
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS admin_shift_id UUID REFERENCES public.admin_shifts(id) ON DELETE SET NULL;

-- Add constraint: can't have both class_id and admin_shift_id
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_class_or_admin_shift_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_class_or_admin_shift_check 
  CHECK (
    (class_id IS NULL AND admin_shift_id IS NULL) OR
    (class_id IS NOT NULL AND admin_shift_id IS NULL) OR
    (class_id IS NULL AND admin_shift_id IS NOT NULL)
  );

-- Add constraint: admin_shift_id only valid if type = ADMIN_SHIFT
-- Note: Using text comparison to avoid unsafe enum value usage in same transaction
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_admin_shift_type_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_admin_shift_type_check
  CHECK (
    (admin_shift_id IS NULL) OR
    (type::text = 'ADMIN_SHIFT' AND admin_shift_id IS NOT NULL)
  );

-- Index for admin_shift_id lookups
CREATE INDEX IF NOT EXISTS idx_sessions_admin_shift_id ON public.sessions(admin_shift_id) WHERE admin_shift_id IS NOT NULL;

-- ========================
-- CREATE PRECREATE_ADMIN_SHIFT_SESSIONS FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.precreate_admin_shift_sessions(
  start_date DATE,
  end_date DATE,
  p_created_by UUID DEFAULT NULL,
  p_admin_shift_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  d DATE;
  a RECORD;
  inserted_count INTEGER := 0;
  new_session_id UUID;
  start_local TIMESTAMP;
  end_local TIMESTAMP;
  s_at TIMESTAMPTZ;
  e_at TIMESTAMPTZ;
  actual_start_date DATE;
  actual_end_date DATE;
BEGIN
  -- If p_admin_shift_id is NULL and dates are NULL, default to rest of current year
  IF p_admin_shift_id IS NULL AND start_date IS NULL AND end_date IS NULL THEN
    actual_start_date := CURRENT_DATE;
    actual_end_date := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day';
  ELSIF start_date IS NULL OR end_date IS NULL THEN
    RETURN 0;
  ELSE
    actual_start_date := start_date;
    actual_end_date := end_date;
  END IF;

  IF actual_start_date > actual_end_date THEN
    RETURN 0;
  END IF;

  FOR a IN
    SELECT id, day_of_week, start_time, end_time, status
    FROM public.admin_shifts
    WHERE (p_admin_shift_id IS NULL OR id = p_admin_shift_id)
      AND status = 'ACTIVE'
  LOOP
    d := actual_start_date;
    WHILE d <= actual_end_date LOOP
      -- day_of_week: Postgres DOW 0=Sunday..6=Saturday; our schema uses 0..6 as well
      IF EXTRACT(DOW FROM d) = a.day_of_week THEN
        -- Build start/end timestamps using Adelaide timezone
        -- Interpret admin shift times (stored as 'HH24:MI' text) as Adelaide local times
        start_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(a.start_time, '00:00'))::timestamp;
        end_local := (to_char(d, 'YYYY-MM-DD') || ' ' || COALESCE(a.end_time, COALESCE(a.start_time, '00:00')))::timestamp;
        
        -- Convert Adelaide local time to UTC for storage
        s_at := start_local AT TIME ZONE 'Australia/Adelaide';
        e_at := end_local AT TIME ZONE 'Australia/Adelaide';

        -- Find existing session for this admin_shift/start/end (idempotency check)
        SELECT s.id
        INTO new_session_id
        FROM public.sessions s
        WHERE s.admin_shift_id = a.id
          AND s.start_at = s_at
          AND s.end_at = e_at
        LIMIT 1;

        -- If not found, create it (idempotent - only creates if doesn't exist)
        IF new_session_id IS NULL THEN
          INSERT INTO public.sessions(
            id, start_at, end_at, type, admin_shift_id, status
          ) VALUES (
            gen_random_uuid(),
            s_at,
            e_at,
            'ADMIN_SHIFT',
            a.id,
            a.status  -- Match admin shift status
          ) RETURNING id INTO new_session_id;
          inserted_count := inserted_count + 1;
        END IF;

        -- Precreate planned staff for the session (idempotent with ON CONFLICT)
        INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
        SELECT
          gen_random_uuid(),
          new_session_id,
          ast.staff_id,
          'MAIN_TUTOR', -- Use MAIN_TUTOR type for admin staff (consistent with classes)
          p_created_by
        FROM public.admin_shifts_staff ast
        WHERE ast.admin_shift_id = a.id
          AND ast.assigned_at <= s_at
          AND (ast.unassigned_at IS NULL OR ast.unassigned_at > s_at)
          AND NOT EXISTS (
            SELECT 1 FROM public.sessions_staff sf
            WHERE sf.session_id = new_session_id AND sf.staff_id = ast.staff_id
          )
        ON CONFLICT (session_id, staff_id) DO NOTHING;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION public.precreate_admin_shift_sessions IS 'Creates sessions for admin shifts for a date range. Fully idempotent - safe to run multiple times. When p_admin_shift_id is NULL and dates are NULL, defaults to rest of current calendar year. Acts as a cleanup function that ensures sessions exist.';

-- ========================
-- CREATE ADMIN SHIFT INSERT TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.create_sessions_on_admin_shift_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  year_end_date DATE;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Use session_start_date if set, otherwise use CURRENT_DATE (backward compatible)
  IF NEW.session_start_date IS NOT NULL THEN
    start_date := NEW.session_start_date;
  ELSE
    start_date := CURRENT_DATE;
  END IF;
  
  -- Use session_end_date if set, otherwise use end of calendar year containing start_date
  IF NEW.session_end_date IS NOT NULL THEN
    end_date := NEW.session_end_date;
  ELSE
    end_date := DATE_TRUNC('year', start_date) + INTERVAL '1 year' - INTERVAL '1 day';
  END IF;
  
  -- Ensure start_date <= end_date
  IF start_date > end_date THEN
    RAISE WARNING 'session_start_date (%) is after session_end_date (%), skipping session creation', start_date, end_date;
    RETURN NEW;
  END IF;
  
  -- Create sessions for the date range (inclusive)
  PERFORM public.precreate_admin_shift_sessions(
    start_date,
    end_date,
    NULL, -- created_by (system action)
    NEW.id -- p_admin_shift_id (specific admin shift)
  );
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE ADMIN SHIFT DELETE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.delete_future_sessions_on_admin_shift_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete only future sessions (preserve historical data)
  DELETE FROM public.sessions
  WHERE admin_shift_id = OLD.id
    AND start_at >= NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Note: We don't need to explicitly delete sessions_staff
  -- because they have ON DELETE CASCADE foreign keys to sessions
  
  RETURN OLD;
END;
$$;

-- ========================
-- CREATE ADMIN SHIFT DATE UPDATE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.sync_sessions_on_admin_shift_date_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_start_date DATE;
  old_end_date DATE;
  new_start_date DATE;
  new_end_date DATE;
  effective_start_date DATE;
  effective_end_date DATE;
BEGIN
  -- Determine old date range
  IF OLD.session_start_date IS NOT NULL THEN
    old_start_date := OLD.session_start_date;
  ELSE
    old_start_date := CURRENT_DATE;
  END IF;
  
  IF OLD.session_end_date IS NOT NULL THEN
    old_end_date := OLD.session_end_date;
  ELSE
    old_end_date := DATE_TRUNC('year', old_start_date) + INTERVAL '1 year' - INTERVAL '1 day';
  END IF;
  
  -- Determine new date range
  IF NEW.session_start_date IS NOT NULL THEN
    new_start_date := NEW.session_start_date;
  ELSE
    new_start_date := CURRENT_DATE;
  END IF;
  
  IF NEW.session_end_date IS NOT NULL THEN
    new_end_date := NEW.session_end_date;
  ELSE
    new_end_date := DATE_TRUNC('year', new_start_date) + INTERVAL '1 year' - INTERVAL '1 day';
  END IF;
  
  -- Only proceed if dates actually changed
  IF OLD.session_start_date IS DISTINCT FROM NEW.session_start_date 
     OR OLD.session_end_date IS DISTINCT FROM NEW.session_end_date THEN
    
    -- Delete future sessions that are outside the new date range
    DELETE FROM public.sessions
    WHERE admin_shift_id = NEW.id
      AND start_at >= NOW() -- Only future sessions
      AND (
        -- Session is before new start date
        (start_at::DATE < new_start_date)
        OR
        -- Session is after new end date
        (start_at::DATE > new_end_date)
      );
    
    -- Create sessions for the new date range (only future sessions)
    effective_start_date := GREATEST(new_start_date, CURRENT_DATE);
    effective_end_date := new_end_date;
    
    -- Only create if effective_start_date <= effective_end_date
    IF effective_start_date <= effective_end_date THEN
      PERFORM public.precreate_admin_shift_sessions(
        effective_start_date,
        effective_end_date,
        NULL, -- created_by (system action)
        NEW.id -- p_admin_shift_id (specific admin shift)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE ADMIN SHIFT PROPERTY UPDATE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.sync_sessions_on_admin_shift_property_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_affected INTEGER := 0;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Only proceed if day_of_week, start_time, end_time, or status changed
  IF OLD.day_of_week IS DISTINCT FROM NEW.day_of_week
     OR OLD.start_time IS DISTINCT FROM NEW.start_time
     OR OLD.end_time IS DISTINCT FROM NEW.end_time
     OR OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Delete all future sessions for this admin shift
    DELETE FROM public.sessions
    WHERE admin_shift_id = NEW.id
      AND start_at >= NOW();
    
    GET DIAGNOSTICS sessions_affected = ROW_COUNT;
    
    -- Recreate sessions if admin shift is still ACTIVE
    IF NEW.status = 'ACTIVE' THEN
      -- Use session_start_date if set, otherwise use CURRENT_DATE
      IF NEW.session_start_date IS NOT NULL THEN
        start_date := NEW.session_start_date;
      ELSE
        start_date := CURRENT_DATE;
      END IF;
      
      -- Use session_end_date if set, otherwise use end of calendar year
      IF NEW.session_end_date IS NOT NULL THEN
        end_date := NEW.session_end_date;
      ELSE
        end_date := DATE_TRUNC('year', start_date) + INTERVAL '1 year' - INTERVAL '1 day';
      END IF;
      
      -- Only create if start_date <= end_date
      IF start_date <= end_date THEN
        PERFORM public.precreate_admin_shift_sessions(
          GREATEST(start_date, CURRENT_DATE), -- Only future sessions
          end_date,
          NULL, -- created_by (system action)
          NEW.id -- p_admin_shift_id (specific admin shift)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE STAFF ASSIGNMENT SYNC TRIGGER FUNCTIONS
-- ========================

-- Function to sync staff to sessions when assigned to admin shift
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_admin_shift_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_affected INTEGER := 0;
BEGIN
  -- Insert the staff member into all future sessions for this admin shift starting from assigned_at
  INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
  SELECT
    gen_random_uuid(),
    s.id,
    NEW.staff_id,
    'MAIN_TUTOR',
    NEW.created_by
  FROM public.sessions s
  WHERE s.admin_shift_id = NEW.admin_shift_id
    AND s.start_at >= NEW.assigned_at
  ON CONFLICT (session_id, staff_id) DO NOTHING;

  GET DIAGNOSTICS sessions_affected = ROW_COUNT;
  
  RAISE NOTICE 'Assigned staff % to % sessions starting from %', 
    NEW.staff_id, sessions_affected, NEW.assigned_at;
  
  RETURN NEW;
END;
$$;

-- Function to remove staff from sessions when unassigned
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_admin_shift_unassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_affected INTEGER := 0;
BEGIN
  -- Only run if unassigned_at was just set (changed from NULL to a timestamp)
  IF OLD.unassigned_at IS NULL AND NEW.unassigned_at IS NOT NULL THEN
    -- Remove staff from sessions starting from their unassignment date
    -- Preserve sessions where staff has been swapped or marked absent
    DELETE FROM public.sessions_staff ss
    USING public.sessions s
    WHERE ss.session_id = s.id
      AND ss.staff_id = NEW.staff_id
      AND s.admin_shift_id = NEW.admin_shift_id
      AND s.start_at >= NEW.unassigned_at
      AND ss.is_swapped = FALSE
      AND ss.planned_absence = FALSE;
    
    GET DIAGNOSTICS sessions_affected = ROW_COUNT;
    
    RAISE NOTICE 'Removed staff % from % sessions starting from %', 
      NEW.staff_id, sessions_affected, NEW.unassigned_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to re-sync sessions when assignment date is modified
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_admin_shift_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_removed INTEGER := 0;
  sessions_added INTEGER := 0;
BEGIN
  -- Only run if assigned_at was changed
  IF OLD.assigned_at IS DISTINCT FROM NEW.assigned_at THEN
    -- Remove from sessions that are now before the new assigned_at
    DELETE FROM public.sessions_staff ss
    USING public.sessions s
    WHERE ss.session_id = s.id
      AND ss.staff_id = NEW.staff_id
      AND s.admin_shift_id = NEW.admin_shift_id
      AND s.start_at < NEW.assigned_at
      AND s.start_at >= OLD.assigned_at
      AND ss.is_swapped = FALSE
      AND ss.planned_absence = FALSE;
    
    GET DIAGNOSTICS sessions_removed = ROW_COUNT;
    
    -- Add to sessions that are now included
    INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
    SELECT
      gen_random_uuid(),
      s.id,
      NEW.staff_id,
      'MAIN_TUTOR',
      NEW.created_by
    FROM public.sessions s
    WHERE s.admin_shift_id = NEW.admin_shift_id
      AND s.start_at >= NEW.assigned_at
      AND s.start_at < OLD.assigned_at
    ON CONFLICT (session_id, staff_id) DO NOTHING;
    
    GET DIAGNOSTICS sessions_added = ROW_COUNT;
    
    RAISE NOTICE 'Assignment date updated: removed from % sessions, added to % sessions', 
      sessions_removed, sessions_added;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE TRIGGERS
-- ========================

-- Trigger to create sessions when admin shift is inserted
DROP TRIGGER IF EXISTS trigger_create_sessions_on_admin_shift_insert ON public.admin_shifts;
CREATE TRIGGER trigger_create_sessions_on_admin_shift_insert
AFTER INSERT ON public.admin_shifts
FOR EACH ROW
EXECUTE FUNCTION public.create_sessions_on_admin_shift_insert();

-- Trigger to delete future sessions when admin shift is deleted
DROP TRIGGER IF EXISTS trigger_delete_future_sessions_on_admin_shift_delete ON public.admin_shifts;
CREATE TRIGGER trigger_delete_future_sessions_on_admin_shift_delete
BEFORE DELETE ON public.admin_shifts
FOR EACH ROW
EXECUTE FUNCTION public.delete_future_sessions_on_admin_shift_delete();

-- Trigger to sync sessions when admin shift dates change
DROP TRIGGER IF EXISTS trigger_sync_sessions_on_admin_shift_date_update ON public.admin_shifts;
CREATE TRIGGER trigger_sync_sessions_on_admin_shift_date_update
AFTER UPDATE ON public.admin_shifts
FOR EACH ROW
WHEN (
  OLD.session_start_date IS DISTINCT FROM NEW.session_start_date
  OR OLD.session_end_date IS DISTINCT FROM NEW.session_end_date
)
EXECUTE FUNCTION public.sync_sessions_on_admin_shift_date_update();

-- Trigger to sync sessions when admin shift properties change
DROP TRIGGER IF EXISTS trigger_sync_sessions_on_admin_shift_property_update ON public.admin_shifts;
CREATE TRIGGER trigger_sync_sessions_on_admin_shift_property_update
AFTER UPDATE ON public.admin_shifts
FOR EACH ROW
WHEN (
  OLD.day_of_week IS DISTINCT FROM NEW.day_of_week
  OR OLD.start_time IS DISTINCT FROM NEW.start_time
  OR OLD.end_time IS DISTINCT FROM NEW.end_time
  OR OLD.status IS DISTINCT FROM NEW.status
)
EXECUTE FUNCTION public.sync_sessions_on_admin_shift_property_update();

-- Trigger for new staff assignments
DROP TRIGGER IF EXISTS trigger_sync_staff_on_admin_shift_assignment ON public.admin_shifts_staff;
CREATE TRIGGER trigger_sync_staff_on_admin_shift_assignment
AFTER INSERT ON public.admin_shifts_staff
FOR EACH ROW
EXECUTE FUNCTION public.sync_staff_sessions_on_admin_shift_assignment();

-- Trigger for staff unassignments
DROP TRIGGER IF EXISTS trigger_sync_staff_on_admin_shift_unassignment ON public.admin_shifts_staff;
CREATE TRIGGER trigger_sync_staff_on_admin_shift_unassignment
AFTER UPDATE ON public.admin_shifts_staff
FOR EACH ROW
EXECUTE FUNCTION public.sync_staff_sessions_on_admin_shift_unassignment();

-- Trigger for assignment date changes
DROP TRIGGER IF EXISTS trigger_sync_staff_on_admin_shift_assignment_update ON public.admin_shifts_staff;
CREATE TRIGGER trigger_sync_staff_on_admin_shift_assignment_update
AFTER UPDATE ON public.admin_shifts_staff
FOR EACH ROW
WHEN (OLD.assigned_at IS DISTINCT FROM NEW.assigned_at)
EXECUTE FUNCTION public.sync_staff_sessions_on_admin_shift_assignment_update();

-- ========================
-- ADD ACTIVITY EVENTS TRIGGERS
-- ========================

-- Helper function for admin_shifts table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_admin_shifts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_shift_id UUID;
  v_performed_by UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('admin_shifts');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_admin_shift_id := NEW.id;
    IF TG_OP = 'UPDATE' THEN
      FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
        v_field_excluded := v_field_name = ANY(v_excluded_fields);
        IF NOT v_field_excluded THEN
          IF (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
            v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
              v_field_name,
              jsonb_build_object(
                'old', to_jsonb(OLD)->v_field_name,
                'new', to_jsonb(NEW)->v_field_name
              )
            );
          END IF;
        END IF;
      END LOOP;
      
      IF v_changed_fields IS NULL THEN
        RETURN NEW;
      END IF;
    END IF;
  ELSE
    v_admin_shift_id := OLD.id;
  END IF;
  
  PERFORM public.log_activity_event(
    p_entity_type := 'admin_shifts',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'admin_shifts'),
    p_student_id := NULL,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for admin_shifts_staff table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_admin_shifts_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_shift_id UUID;
  v_staff_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('admin_shifts_staff');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_admin_shift_id := NEW.admin_shift_id;
    v_staff_id := NEW.staff_id;
  ELSE
    v_admin_shift_id := OLD.admin_shift_id;
    v_staff_id := OLD.staff_id;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      v_field_excluded := v_field_name = ANY(v_excluded_fields);
      IF NOT v_field_excluded THEN
        IF (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
          v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
            v_field_name,
            jsonb_build_object(
              'old', to_jsonb(OLD)->v_field_name,
              'new', to_jsonb(NEW)->v_field_name
            )
          );
        END IF;
      END IF;
    END LOOP;
    
    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  PERFORM public.log_activity_event(
    p_entity_type := 'admin_shifts_staff',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'admin_shifts_staff'),
    p_student_id := NULL,
    p_staff_id := v_staff_id,
    p_class_id := NULL,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Create triggers for activity events
DROP TRIGGER IF EXISTS trigger_activity_events_admin_shifts ON public.admin_shifts;
CREATE TRIGGER trigger_activity_events_admin_shifts
AFTER INSERT OR UPDATE OR DELETE ON public.admin_shifts
FOR EACH ROW
EXECUTE FUNCTION public.extract_activity_fks_admin_shifts();

DROP TRIGGER IF EXISTS trigger_activity_events_admin_shifts_staff ON public.admin_shifts_staff;
CREATE TRIGGER trigger_activity_events_admin_shifts_staff
AFTER INSERT OR UPDATE OR DELETE ON public.admin_shifts_staff
FOR EACH ROW
EXECUTE FUNCTION public.extract_activity_fks_admin_shifts_staff();

-- ========================
-- COMMENTS
-- ========================

COMMENT ON TABLE public.admin_shifts IS 'Recurring weekly admin staff shifts. Each shift represents a fixed time slot (e.g., Monday 9:00-12:30) that repeats weekly. Sessions are automatically created from these shifts.';
COMMENT ON TABLE public.admin_shifts_staff IS 'Staff assignments to admin shifts. Tracks when staff are assigned/unassigned to shifts. Staff assignments automatically sync to future sessions.';
COMMENT ON FUNCTION public.precreate_admin_shift_sessions IS 'Creates sessions for admin shifts for a date range. Fully idempotent - safe to run multiple times.';
COMMENT ON FUNCTION public.create_sessions_on_admin_shift_insert IS 'Trigger function that creates sessions when an admin shift is created. Respects session_start_date and session_end_date columns.';
COMMENT ON FUNCTION public.delete_future_sessions_on_admin_shift_delete IS 'Trigger function that deletes only future sessions when an admin shift is deleted, preserving historical data.';
COMMENT ON FUNCTION public.sync_sessions_on_admin_shift_date_update IS 'Trigger function that syncs sessions when admin shift dates are updated. Only affects future sessions.';
COMMENT ON FUNCTION public.sync_sessions_on_admin_shift_property_update IS 'Trigger function that syncs sessions when admin shift properties (day, time, status) are updated. Recreates future sessions.';
