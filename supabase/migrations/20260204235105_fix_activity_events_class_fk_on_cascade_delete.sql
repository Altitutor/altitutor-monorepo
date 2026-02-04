-- Migration: Fix activity_events foreign key constraint violation on class cascade deletes
-- Description:
--   When classes are deleted, cascade deletes occur on classes_staff and classes_students tables.
--   The activity_events triggers for these tables were trying to reference the deleted class_id,
--   causing foreign key constraint violations.
--   
--   This migration updates the two trigger functions to:
--   1. Set class_id to NULL on DELETE operations (avoiding FK constraint violations)
--   2. Store the deleted class_id in metadata for audit trail purposes
--   
--   This matches the pattern already used in extract_activity_fks_sessions() function and
--   the fix applied to sessions_staff, sessions_students, and sessions_files triggers.
-- Author: AI Assistant
-- Date: 2026-02-04
-- Related Issue: Class deletion failing with 409 Conflict error

-- ========================
-- FIX classes_staff ACTIVITY TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_classes_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_class_id UUID;
  v_staff_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('classes_staff');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_class_id := NEW.class_id;
    v_staff_id := NEW.staff_id;
  ELSE
    -- For DELETE, set class_id to NULL to avoid FK constraint violations
    -- Store deleted class_id in metadata instead
    v_class_id := NULL;
    v_staff_id := OLD.staff_id; -- staff_id can stay since staff aren't being deleted
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
    p_entity_type := 'classes_staff',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP, 
      'table', 'classes_staff',
      'deleted_class_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.class_id ELSE NULL END
    ),
    p_student_id := NULL,
    p_staff_id := v_staff_id,
    p_class_id := v_class_id,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ========================
-- FIX classes_students ACTIVITY TRIGGER FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_classes_students()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_class_id UUID;
  v_student_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('classes_students');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_class_id := NEW.class_id;
    v_student_id := NEW.student_id;
  ELSE
    -- For DELETE, set class_id to NULL to avoid FK constraint violations
    -- Store deleted class_id in metadata instead
    v_class_id := NULL;
    v_student_id := OLD.student_id; -- student_id can stay since students aren't being deleted
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
    p_entity_type := 'classes_students',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP, 
      'table', 'classes_students',
      'deleted_class_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.class_id ELSE NULL END
    ),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := v_class_id,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.extract_activity_fks_classes_staff IS 'Activity events trigger for classes_staff table. Sets class_id to NULL on DELETE to avoid FK constraint violations when classes are cascade deleted. Stores deleted class_id in metadata.';
COMMENT ON FUNCTION public.extract_activity_fks_classes_students IS 'Activity events trigger for classes_students table. Sets class_id to NULL on DELETE to avoid FK constraint violations when classes are cascade deleted. Stores deleted class_id in metadata.';
