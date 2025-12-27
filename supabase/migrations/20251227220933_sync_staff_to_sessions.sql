-- Migration: Sync staff assignments to sessions
-- Description:
--   - Create trigger functions to sync staff assignments/unassignments to future sessions
--   - Uses assigned_at/unassigned_at fields (from migration 20251117000000_auditable_class_staff.sql)
--   - Preserves staff assignments that have been swapped or have planned absences

-- ========================
-- CREATE TRIGGER FUNCTIONS
-- ========================

-- Function to sync staff to sessions when assigned to class
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_affected INTEGER := 0;
BEGIN
  -- Insert the staff member into all future sessions for this class starting from assigned_at
  INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
  SELECT
    uuid_generate_v4(),
    s.id,
    NEW.staff_id,
    'MAIN_TUTOR',
    NEW.assigned_by
  FROM public.sessions s
  WHERE s.class_id = NEW.class_id
    AND s.start_at >= NEW.assigned_at
  ON CONFLICT (session_id, staff_id) DO NOTHING;

  GET DIAGNOSTICS sessions_affected = ROW_COUNT;
  
  RAISE NOTICE 'Assigned staff % to % sessions starting from %', 
    NEW.staff_id, sessions_affected, NEW.assigned_at;
  
  RETURN NEW;
END;
$$;

-- Function to remove staff from sessions when unassigned
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_unassignment()
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
      AND s.class_id = NEW.class_id
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
CREATE OR REPLACE FUNCTION public.sync_staff_sessions_on_assignment_update()
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
      AND s.class_id = NEW.class_id
      AND s.start_at < NEW.assigned_at
      AND s.start_at >= OLD.assigned_at
      AND ss.is_swapped = FALSE
      AND ss.planned_absence = FALSE;
    
    GET DIAGNOSTICS sessions_removed = ROW_COUNT;
    
    -- Add to sessions that are now included
    INSERT INTO public.sessions_staff (id, session_id, staff_id, type, created_by)
    SELECT
      uuid_generate_v4(),
      s.id,
      NEW.staff_id,
      'MAIN_TUTOR',
      NEW.assigned_by
    FROM public.sessions s
    WHERE s.class_id = NEW.class_id
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

-- Trigger for new assignments
DROP TRIGGER IF EXISTS trigger_sync_staff_on_assignment ON public.classes_staff;
CREATE TRIGGER trigger_sync_staff_on_assignment
AFTER INSERT ON public.classes_staff
FOR EACH ROW
EXECUTE FUNCTION public.sync_staff_sessions_on_assignment();

-- Trigger for unassignments
DROP TRIGGER IF EXISTS trigger_sync_staff_on_unassignment ON public.classes_staff;
CREATE TRIGGER trigger_sync_staff_on_unassignment
AFTER UPDATE ON public.classes_staff
FOR EACH ROW
EXECUTE FUNCTION public.sync_staff_sessions_on_unassignment();

-- Trigger for assignment date changes
DROP TRIGGER IF EXISTS trigger_sync_staff_on_assignment_update ON public.classes_staff;
CREATE TRIGGER trigger_sync_staff_on_assignment_update
AFTER UPDATE ON public.classes_staff
FOR EACH ROW
WHEN (OLD.assigned_at IS DISTINCT FROM NEW.assigned_at)
EXECUTE FUNCTION public.sync_staff_sessions_on_assignment_update();

