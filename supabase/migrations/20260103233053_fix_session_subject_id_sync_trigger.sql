-- Migration: Fix session subject_id sync trigger
-- Description:
--   - Update ensure_session_subject_id() to always sync subject_id from class when class_id is set
--   - Previously only populated subject_id when it was NULL, allowing mismatches
--   - Now enforces that sessions with class_id always have matching subject_id
--   - Fix existing sessions with mismatched subject_ids

-- ========================
-- FIX EXISTING SESSIONS
-- ========================

-- Update sessions that have class_id but subject_id doesn't match class subject_id
UPDATE public.sessions s
SET subject_id = c.subject_id
FROM public.classes c
WHERE s.class_id = c.id
  AND s.subject_id IS DISTINCT FROM c.subject_id
  AND c.subject_id IS NOT NULL;

-- ========================
-- UPDATE TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.ensure_session_subject_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  class_subject_id UUID;
BEGIN
  -- If session has class_id, always sync subject_id from class
  IF NEW.class_id IS NOT NULL THEN
    SELECT subject_id INTO class_subject_id
    FROM public.classes
    WHERE id = NEW.class_id;
    
    -- If class doesn't have subject_id, raise error
    IF class_subject_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create/update session: class % does not have a subject_id', NEW.class_id;
    END IF;
    
    -- Always set subject_id to match class (even if it was already set)
    NEW.subject_id := class_subject_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.ensure_session_subject_id IS 'Trigger function that ensures sessions with class_id always have subject_id matching the class. Enforces sync on both INSERT and UPDATE to prevent mismatches.';
