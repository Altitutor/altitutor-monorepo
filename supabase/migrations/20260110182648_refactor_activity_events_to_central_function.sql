-- Migration: Refactor activity events to use central log function
-- Description: Create central log_activity_event function that handles both
--              activity event insertion and automation triggering. Update all
--              24 table-specific extract_activity_fks_* functions to use it.
-- Author: AI Assistant
-- Date: 2026-01-10
-- Related Issue: ALTI-125

-- ========================
-- CREATE CENTRAL LOG FUNCTION
-- ========================

-- Central function that handles activity event insertion and automation triggering
CREATE OR REPLACE FUNCTION public.log_activity_event(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_event_type TEXT,
  p_changed_fields JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_student_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id UUID;
  v_performed_by UUID;
  v_has_matching_rules BOOLEAN;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get performed_by from auth context (current staff ID)
  SELECT public.current_staff_id() INTO v_performed_by;
  
  -- Insert activity event and get the ID
  INSERT INTO public.activity_events (
    entity_type,
    entity_id,
    event_type,
    changed_fields,
    metadata,
    student_id,
    staff_id,
    class_id,
    session_id,
    task_id,
    parent_id,
    performed_by,
    performed_at
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_event_type,
    p_changed_fields,
    COALESCE(p_metadata, jsonb_build_object('operation', 'UNKNOWN', 'table', p_entity_type)),
    p_student_id,
    p_staff_id,
    p_class_id,
    p_session_id,
    p_task_id,
    p_parent_id,
    v_performed_by,
    NOW()
  )
  RETURNING id INTO v_activity_id;
  
  -- Optimization: Quick check for matching enabled rules before calling edge function
  -- This avoids expensive HTTP calls when no rules exist for this event type
  -- Only check if pg_net extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.automation_rules
      WHERE enabled = true
        AND entity_type = p_entity_type
        AND p_event_type = ANY(event_types)
    ) INTO v_has_matching_rules;
    
    -- Only call edge function if matching rules exist
    IF v_has_matching_rules THEN
      -- Get Supabase URL and service role key
      BEGIN
        v_supabase_url := public.get_supabase_url();
        v_service_key := public.get_service_role_key();
        
        -- Only proceed if we have both values
        IF v_supabase_url IS NOT NULL AND v_supabase_url != '' AND v_service_key IS NOT NULL AND v_service_key != '' THEN
          -- Call edge function asynchronously (fire-and-forget)
          -- Errors are logged but don't fail the trigger
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/activity-processor',
            headers := jsonb_build_object(
              'Authorization', 'Bearer ' || v_service_key,
              'Content-Type', 'application/json'
            ),
            body := jsonb_build_object('activity_id', v_activity_id),
            timeout_milliseconds := 5000
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the trigger
        -- Edge function errors are handled separately
        RAISE WARNING 'Failed to call activity-processor edge function for activity %: %', v_activity_id, SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN v_activity_id;
END;
$$;

COMMENT ON FUNCTION public.log_activity_event IS 'Central function for logging activity events and triggering automation. Handles both activity event insertion and automation rule matching/edge function invocation.';

-- ========================
-- UPDATE TABLE-SPECIFIC FUNCTIONS
-- ========================

-- Helper function for tasks table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID := NULL;
  v_staff_id UUID := NULL;
  v_class_id UUID := NULL;
  v_session_id UUID := NULL;
  v_task_id UUID := NULL;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tasks');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  -- Determine event type
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_task_id := NEW.id;
    v_staff_id := NEW.assigned_to;
  ELSE
    -- For DELETE, store the task_id in entity_id but set FK to NULL to avoid constraint violation
    v_task_id := NULL;
    v_staff_id := OLD.assigned_to;
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
  
  -- Call central log function
  PERFORM public.log_activity_event(
    p_entity_type := 'tasks',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'tasks', 'deleted_task_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    p_student_id := v_student_id,
    p_staff_id := v_staff_id,
    p_class_id := v_class_id,
    p_session_id := v_session_id,
    p_task_id := v_task_id,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for classes table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_classes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_class_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('classes');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_class_id := NEW.id;
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
    END IF;
  ELSE
    v_class_id := NULL;
  END IF;
  
  -- Skip if no changes in UPDATE
  IF TG_OP = 'UPDATE' AND v_changed_fields IS NULL THEN
    RETURN NEW;
  END IF;
  
  PERFORM public.log_activity_event(
    p_entity_type := 'classes',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'classes', 'deleted_class_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    p_student_id := NULL,
    p_staff_id := NULL,
    p_class_id := v_class_id,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for classes_staff table
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
    v_class_id := OLD.class_id;
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
    p_entity_type := 'classes_staff',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'classes_staff'),
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

-- Helper function for classes_students table
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
    v_class_id := OLD.class_id;
    v_student_id := OLD.student_id;
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
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'classes_students'),
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

-- Helper function for sessions table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id UUID;
  v_class_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('sessions');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.id;
    v_class_id := NEW.class_id;
  ELSE
    v_session_id := NULL;
    v_class_id := OLD.class_id;
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
    p_entity_type := 'sessions',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'sessions', 'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    p_student_id := NULL,
    p_staff_id := NULL,
    p_class_id := v_class_id,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for sessions_students table
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
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_student_id := NEW.student_id;
  ELSE
    v_session_id := OLD.session_id;
    v_student_id := OLD.student_id;
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
    p_entity_type := 'sessions_students',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'sessions_students'),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for sessions_staff table
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
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_staff_id := NEW.staff_id;
  ELSE
    v_session_id := OLD.session_id;
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
    p_entity_type := 'sessions_staff',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'sessions_staff'),
    p_student_id := NULL,
    p_staff_id := v_staff_id,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for sessions_files table
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
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
  ELSE
    v_session_id := OLD.session_id;
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
    p_entity_type := 'sessions_files',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'sessions_files'),
    p_student_id := NULL,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for students table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_students()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('students');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.id;
  ELSE
    v_student_id := NULL;
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
    p_entity_type := 'students',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'students', 'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for staff table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_staff_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('staff');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_staff_id := NEW.id;
  ELSE
    v_staff_id := NULL;
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
    p_entity_type := 'staff',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'staff', 'deleted_staff_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
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

-- Helper function for parents table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_parents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('parents');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_parent_id := NEW.id;
  ELSE
    v_parent_id := NULL;
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
    p_entity_type := 'parents',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'parents', 'deleted_parent_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    p_student_id := NULL,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := v_parent_id
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for parents_students table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_parents_students()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_id UUID;
  v_student_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('parents_students');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_parent_id := NEW.parent_id;
    v_student_id := NEW.student_id;
  ELSE
    v_parent_id := OLD.parent_id;
    v_student_id := OLD.student_id;
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
    p_entity_type := 'parents_students',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'parents_students'),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := v_parent_id
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for invoices table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('invoices');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
  ELSE
    v_student_id := OLD.student_id;
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
    p_entity_type := 'invoices',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'invoices'),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for invoice_items table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_invoice_items()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('invoice_items');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_invoice_id := NEW.invoice_id;
  ELSE
    v_invoice_id := OLD.invoice_id;
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
  
  -- Note: invoice_items doesn't have direct FK to activity_events, so we use NULL
  PERFORM public.log_activity_event(
    p_entity_type := 'invoice_items',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'invoice_items', 'invoice_id', v_invoice_id),
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

-- Helper function for notes table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID := NULL;
  v_staff_id UUID := NULL;
  v_class_id UUID := NULL;
  v_session_id UUID := NULL;
  v_parent_id UUID := NULL;
  v_target_type TEXT;
  v_target_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('notes');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  -- Extract target_type and target_id
  IF TG_OP != 'DELETE' THEN
    v_target_type := NEW.target_type;
    v_target_id := NEW.target_id;
  ELSE
    v_target_type := OLD.target_type;
    v_target_id := OLD.target_id;
  END IF;
  
  -- Extract appropriate FK based on target_type (case-insensitive)
  CASE UPPER(v_target_type)
    WHEN 'STUDENT' THEN
      v_student_id := v_target_id;
    WHEN 'STAFF' THEN
      v_staff_id := v_target_id;
    WHEN 'PARENT' THEN
      v_parent_id := v_target_id;
    WHEN 'CLASS' THEN
      v_class_id := v_target_id;
    WHEN 'SESSION' THEN
      v_session_id := v_target_id;
    ELSE
      -- Unknown target_type, leave all FKs as NULL
      NULL;
  END CASE;
  
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
    p_entity_type := 'notes',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'notes', 'target_type', v_target_type, 'target_id', v_target_id),
    p_student_id := v_student_id,
    p_staff_id := v_staff_id,
    p_class_id := v_class_id,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := v_parent_id
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for student_subsidies table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_student_subsidies()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('student_subsidies');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
  ELSE
    v_student_id := OLD.student_id;
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
    p_entity_type := 'student_subsidies',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'student_subsidies'),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for students_subjects table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_students_subjects()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('students_subjects');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
  ELSE
    v_student_id := OLD.student_id;
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
    p_entity_type := 'students_subjects',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'students_subjects'),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := NULL,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for tutor_logs table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tutor_logs');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
  ELSE
    v_session_id := OLD.session_id;
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
    p_entity_type := 'tutor_logs',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs'),
    p_student_id := NULL,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for tutor_logs_staff_attendance table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_staff_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tutor_log_id UUID;
  v_staff_id UUID;
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tutor_logs_staff_attendance');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_tutor_log_id := NEW.tutor_log_id;
    v_staff_id := NEW.staff_id;
    SELECT session_id INTO v_session_id FROM tutor_logs WHERE id = v_tutor_log_id;
  ELSE
    v_tutor_log_id := OLD.tutor_log_id;
    v_staff_id := OLD.staff_id;
    SELECT session_id INTO v_session_id FROM tutor_logs WHERE id = v_tutor_log_id;
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
    p_entity_type := 'tutor_logs_staff_attendance',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_staff_attendance'),
    p_student_id := NULL,
    p_staff_id := v_staff_id,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for tutor_logs_student_attendance table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_student_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tutor_log_id UUID;
  v_student_id UUID;
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tutor_logs_student_attendance');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_tutor_log_id := NEW.tutor_log_id;
    v_student_id := NEW.student_id;
    SELECT session_id INTO v_session_id FROM tutor_logs WHERE id = v_tutor_log_id;
  ELSE
    v_tutor_log_id := OLD.tutor_log_id;
    v_student_id := OLD.student_id;
    SELECT session_id INTO v_session_id FROM tutor_logs WHERE id = v_tutor_log_id;
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
    p_entity_type := 'tutor_logs_student_attendance',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_student_attendance'),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for tutor_logs_topics table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_topics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tutor_log_id UUID;
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tutor_logs_topics');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_tutor_log_id := NEW.tutor_log_id;
    SELECT session_id INTO v_session_id FROM tutor_logs WHERE id = v_tutor_log_id;
  ELSE
    v_tutor_log_id := OLD.tutor_log_id;
    SELECT session_id INTO v_session_id FROM tutor_logs WHERE id = v_tutor_log_id;
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
    p_entity_type := 'tutor_logs_topics',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_topics'),
    p_student_id := NULL,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for tutor_logs_topics_files table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_topics_files()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tutor_log_id UUID;
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tutor_logs_topics_files');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_tutor_log_id := NEW.tutor_log_id;
    SELECT session_id INTO v_session_id FROM tutor_logs WHERE id = v_tutor_log_id;
  ELSE
    v_tutor_log_id := OLD.tutor_log_id;
    SELECT session_id INTO v_session_id FROM tutor_logs WHERE id = v_tutor_log_id;
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
    p_entity_type := 'tutor_logs_topics_files',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_topics_files'),
    p_student_id := NULL,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for tutor_logs_topics_files_students table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_topics_files_students()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tutor_logs_topics_files_id UUID;
  v_student_id UUID;
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tutor_logs_topics_files_students');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
    SELECT tl.session_id INTO v_session_id
    FROM public.tutor_logs_topics_files tltf
    JOIN public.tutor_logs tl ON tl.id = tltf.tutor_log_id
    WHERE tltf.id = NEW.tutor_logs_topics_files_id;
  ELSE
    v_student_id := OLD.student_id;
    SELECT tl.session_id INTO v_session_id
    FROM public.tutor_logs_topics_files tltf
    JOIN public.tutor_logs tl ON tl.id = tltf.tutor_log_id
    WHERE tltf.id = OLD.tutor_logs_topics_files_id;
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
    p_entity_type := 'tutor_logs_topics_files_students',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_topics_files_students'),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for tutor_logs_topics_students table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_topics_students()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tutor_logs_topics_id UUID;
  v_student_id UUID;
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tutor_logs_topics_students');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
    SELECT tl.session_id INTO v_session_id
    FROM public.tutor_logs_topics tlt
    JOIN public.tutor_logs tl ON tl.id = tlt.tutor_log_id
    WHERE tlt.id = NEW.tutor_logs_topics_id;
  ELSE
    v_student_id := OLD.student_id;
    SELECT tl.session_id INTO v_session_id
    FROM public.tutor_logs_topics tlt
    JOIN public.tutor_logs tl ON tl.id = tlt.tutor_log_id
    WHERE tlt.id = OLD.tutor_logs_topics_id;
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
    p_entity_type := 'tutor_logs_topics_students',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_topics_students'),
    p_student_id := v_student_id,
    p_staff_id := NULL,
    p_class_id := NULL,
    p_session_id := v_session_id,
    p_task_id := NULL,
    p_parent_id := NULL
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

