-- Migration: Fix activity_events foreign key constraint violation on session cascade deletes
-- Description:
--   When sessions are deleted (e.g., via class date updates), cascade deletes occur
--   on sessions_students, sessions_staff, and sessions_files tables. The activity_events
--   triggers for these tables were trying to reference the deleted session_id, causing
--   foreign key constraint violations.
--   
--   This migration updates the three trigger functions to:
--   1. Set session_id to NULL on DELETE operations (avoiding FK constraint violations)
--   2. Store the deleted session_id in metadata for audit trail purposes
--   
--   This matches the pattern already used in extract_activity_fks_sessions() function.
-- Author: AI Assistant
-- Date: 2026-01-21
-- Related Issue: Foreign key constraint violation when updating class session_start_date

-- ========================
-- FIX sessions_students ACTIVITY TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_sessions_students()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id UUID;
  v_student_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('sessions_students');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_student_id := NEW.student_id;
  ELSE
    -- For DELETE, set session_id to NULL to avoid FK constraint violations
    -- Store deleted session_id in metadata instead
    v_session_id := NULL;
    v_student_id := OLD.student_id; -- student_id can stay since students aren't being deleted
  END IF;
  
    -- Build changed_fields for UPDATE, excluding specified fields
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
    
    -- Skip if no changes
    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'sessions_students',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object(
      'operation', TG_OP, 
      'table', 'sessions_students',
      'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NULL END
    ),
    v_student_id, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ========================
-- FIX sessions_staff ACTIVITY TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_sessions_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id UUID;
  v_staff_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('sessions_staff');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_staff_id := NEW.staff_id;
  ELSE
    -- For DELETE, set session_id to NULL to avoid FK constraint violations
    -- Store deleted session_id in metadata instead
    v_session_id := NULL;
    v_staff_id := OLD.staff_id; -- staff_id can stay since staff aren't being deleted
  END IF;
  
    -- Build changed_fields for UPDATE, excluding specified fields
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
    
    -- Skip if no changes
    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'sessions_staff',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object(
      'operation', TG_OP, 
      'table', 'sessions_staff',
      'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NULL END
    ),
    NULL, v_staff_id, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ========================
-- FIX sessions_files ACTIVITY TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_sessions_files()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('sessions_files');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
  ELSE
    -- For DELETE, set session_id to NULL to avoid FK constraint violations
    -- Store deleted session_id in metadata instead
    v_session_id := NULL;
  END IF;
  
    -- Build changed_fields for UPDATE, excluding specified fields
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
    
    -- Skip if no changes
    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'sessions_files',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object(
      'operation', TG_OP, 
      'table', 'sessions_files',
      'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NULL END
    ),
    NULL, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.extract_activity_fks_sessions_students IS 'Activity events trigger for sessions_students table. Sets session_id to NULL on DELETE to avoid FK constraint violations when sessions are cascade deleted. Stores deleted session_id in metadata.';
COMMENT ON FUNCTION public.extract_activity_fks_sessions_staff IS 'Activity events trigger for sessions_staff table. Sets session_id to NULL on DELETE to avoid FK constraint violations when sessions are cascade deleted. Stores deleted session_id in metadata.';
COMMENT ON FUNCTION public.extract_activity_fks_sessions_files IS 'Activity events trigger for sessions_files table. Sets session_id to NULL on DELETE to avoid FK constraint violations when sessions are cascade deleted. Stores deleted session_id in metadata.';
