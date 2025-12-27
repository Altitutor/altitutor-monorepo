-- Migration: Sync sessions when class properties change
-- Description:
--   - Create trigger function to sync class property changes to future sessions
--   - Handles day_of_week, start_time, end_time, subject_id, and status changes
--   - Only updates future sessions (start_at >= NOW()) to preserve historical data

-- ========================
-- CREATE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.sync_sessions_on_class_property_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  sessions_updated INTEGER := 0;
  session_rec RECORD;
  new_date DATE;
  start_local TIMESTAMP;
  end_local TIMESTAMP;
  s_at TIMESTAMPTZ;
  e_at TIMESTAMPTZ;
  days_to_adjust INTEGER;
  current_dow INTEGER;
BEGIN
  -- Only process if relevant fields changed
  IF (OLD.day_of_week IS DISTINCT FROM NEW.day_of_week)
     OR (OLD.start_time IS DISTINCT FROM NEW.start_time)
     OR (OLD.end_time IS DISTINCT FROM NEW.end_time)
     OR (OLD.subject_id IS DISTINCT FROM NEW.subject_id)
     OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Get all future sessions for this class
    FOR session_rec IN
      SELECT id, start_at, end_at
      FROM public.sessions
      WHERE class_id = NEW.id
        AND start_at >= NOW()
    LOOP
      -- If day_of_week, start_time, or end_time changed, recalculate timestamps
      IF (OLD.day_of_week IS DISTINCT FROM NEW.day_of_week)
         OR (OLD.start_time IS DISTINCT FROM NEW.start_time)
         OR (OLD.end_time IS DISTINCT FROM NEW.end_time) THEN
        
        -- Extract the date from the existing session
        new_date := (session_rec.start_at AT TIME ZONE 'Australia/Adelaide')::DATE;
        
        -- Adjust to the new day_of_week if it changed
        IF OLD.day_of_week IS DISTINCT FROM NEW.day_of_week THEN
          -- Calculate how many days to adjust
          -- DOW: 0=Sunday, 1=Monday, ..., 6=Saturday
          current_dow := EXTRACT(DOW FROM new_date);
          days_to_adjust := NEW.day_of_week - current_dow;
          
          -- Handle wrap-around (e.g., Saturday to Sunday)
          IF days_to_adjust < -3 THEN
            days_to_adjust := days_to_adjust + 7;
          ELSIF days_to_adjust > 3 THEN
            days_to_adjust := days_to_adjust - 7;
          END IF;
          
          new_date := new_date + (days_to_adjust || ' days')::INTERVAL;
        END IF;
        
        -- Build new timestamps using updated day/time
        start_local := (to_char(new_date, 'YYYY-MM-DD') || ' ' || COALESCE(NEW.start_time, '00:00'))::timestamp;
        end_local := (to_char(new_date, 'YYYY-MM-DD') || ' ' || COALESCE(NEW.end_time, COALESCE(NEW.start_time, '00:00')))::timestamp;
        
        -- Convert Adelaide local time to UTC for storage
        s_at := start_local AT TIME ZONE 'Australia/Adelaide';
        e_at := end_local AT TIME ZONE 'Australia/Adelaide';
        
        -- Update the session
        UPDATE public.sessions
        SET 
          start_at = s_at,
          end_at = e_at,
          subject_id = CASE 
            WHEN OLD.subject_id IS DISTINCT FROM NEW.subject_id THEN NEW.subject_id
            ELSE subject_id
          END,
          status = CASE
            WHEN OLD.status IS DISTINCT FROM NEW.status THEN NEW.status
            ELSE status
          END
        WHERE id = session_rec.id;
        
        sessions_updated := sessions_updated + 1;
      ELSE
        -- Only subject_id or status changed, simpler update
        UPDATE public.sessions
        SET 
          subject_id = CASE 
            WHEN OLD.subject_id IS DISTINCT FROM NEW.subject_id THEN NEW.subject_id
            ELSE subject_id
          END,
          status = CASE
            WHEN OLD.status IS DISTINCT FROM NEW.status THEN NEW.status
            ELSE status
          END
        WHERE id = session_rec.id;
        
        sessions_updated := sessions_updated + 1;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Updated % future sessions for class %', sessions_updated, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE TRIGGER
-- ========================

DROP TRIGGER IF EXISTS trigger_sync_sessions_on_class_update ON public.classes;

CREATE TRIGGER trigger_sync_sessions_on_class_update
AFTER UPDATE ON public.classes
FOR EACH ROW
EXECUTE FUNCTION public.sync_sessions_on_class_property_change();

