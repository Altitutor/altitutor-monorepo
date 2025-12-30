-- Migration: Fix sessions missing subject_id and add constraints
-- Description:
--   - Fix existing sessions that have class_id but missing subject_id by populating from class
--   - Add trigger to automatically populate subject_id from class when session is created/updated
--   - Add check constraint to ensure sessions with class_id always have subject_id

-- ========================
-- FIX EXISTING SESSIONS
-- ========================

-- Update sessions that have class_id but missing subject_id
UPDATE public.sessions s
SET subject_id = c.subject_id
FROM public.classes c
WHERE s.class_id = c.id
  AND s.subject_id IS NULL
  AND c.subject_id IS NOT NULL;

-- ========================
-- CREATE TRIGGER FUNCTION TO AUTO-POPULATE SUBJECT_ID
-- ========================

CREATE OR REPLACE FUNCTION public.ensure_session_subject_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If session has class_id but no subject_id, populate from class
  IF NEW.class_id IS NOT NULL AND NEW.subject_id IS NULL THEN
    SELECT subject_id INTO NEW.subject_id
    FROM public.classes
    WHERE id = NEW.class_id;
    
    -- If class doesn't have subject_id either, raise error
    IF NEW.subject_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create session: class % does not have a subject_id', NEW.class_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- CREATE TRIGGERS
-- ========================

DROP TRIGGER IF EXISTS trigger_ensure_session_subject_id ON public.sessions;

CREATE TRIGGER trigger_ensure_session_subject_id
BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_session_subject_id();

-- ========================
-- ADD CHECK CONSTRAINT
-- ========================

-- Add constraint: if class_id is not null, subject_id must also be not null
ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS check_session_subject_id_when_class_exists;

ALTER TABLE public.sessions
ADD CONSTRAINT check_session_subject_id_when_class_exists
CHECK (
  (class_id IS NULL) OR (subject_id IS NOT NULL)
);

