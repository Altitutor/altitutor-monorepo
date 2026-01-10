-- Migration: Update activity_events trigger for automation
-- Description: Add optimization check and edge function call to activity_events trigger
--              Only calls edge function when matching enabled rules exist
-- Author: AI Assistant
-- Date: 2026-01-09
-- Related Issue: ALTI-125

-- ========================
-- UPDATE create_activity_event FUNCTION
-- ========================

CREATE OR REPLACE FUNCTION public.create_activity_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id UUID;
  v_event_type TEXT;
  v_changed_fields JSONB := NULL;
  v_student_id UUID := NULL;
  v_staff_id UUID := NULL;
  v_class_id UUID := NULL;
  v_session_id UUID := NULL;
  v_task_id UUID := NULL;
  v_performed_by UUID;
  v_old_row JSONB;
  v_new_row JSONB;
  v_field_name TEXT;
  v_field_changes JSONB := '{}'::JSONB;
  v_excluded_fields TEXT[];
  v_field_excluded BOOLEAN;
  v_activity_id UUID;
  v_has_matching_rules BOOLEAN;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get entity type from table name (remove 'public.' prefix if present)
  v_entity_type := TG_TABLE_NAME;
  
  -- Determine event type and entity ID
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'CREATED';
    v_entity_id := NEW.id;
    v_new_row := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'UPDATED';
    v_entity_id := NEW.id;
    v_old_row := to_jsonb(OLD);
    v_new_row := to_jsonb(NEW);
    
    -- Get excluded fields for this table
    v_excluded_fields := public.get_excluded_fields_for_table(TG_TABLE_NAME);
    
    -- Build changed_fields JSONB for UPDATE events, excluding specified fields
    FOR v_field_name IN SELECT jsonb_object_keys(v_new_row) LOOP
      -- Check if field is excluded
      v_field_excluded := v_field_name = ANY(v_excluded_fields);
      
      -- Skip excluded fields
      IF NOT v_field_excluded THEN
        IF v_old_row->>v_field_name IS DISTINCT FROM v_new_row->>v_field_name THEN
          v_field_changes := v_field_changes || jsonb_build_object(
            v_field_name,
            jsonb_build_object(
              'old', v_old_row->v_field_name,
              'new', v_new_row->v_field_name
            )
          );
        END IF;
      END IF;
    END LOOP;
    
    -- Only create event if fields actually changed
    IF jsonb_object_keys(v_field_changes) IS NULL THEN
      RETURN NEW; -- No changes, skip activity event
    END IF;
    
    v_changed_fields := v_field_changes;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'DELETED';
    v_entity_id := OLD.id;
    v_old_row := to_jsonb(OLD);
  END IF;
  
  -- Get performed_by from auth context (current staff ID)
  SELECT public.current_staff_id() INTO v_performed_by;
  
  -- Extract foreign keys based on table-specific logic
  -- This will be customized per table via trigger configuration
  -- Default extraction (can be overridden):
  IF TG_OP != 'DELETE' THEN
    v_student_id := (v_new_row->>'student_id')::UUID;
    v_staff_id := (v_new_row->>'staff_id')::UUID;
    v_class_id := (v_new_row->>'class_id')::UUID;
    v_session_id := (v_new_row->>'session_id')::UUID;
    v_task_id := (v_new_row->>'task_id')::UUID;
  ELSE
    v_student_id := (v_old_row->>'student_id')::UUID;
    v_staff_id := (v_old_row->>'staff_id')::UUID;
    v_class_id := (v_old_row->>'class_id')::UUID;
    v_session_id := (v_old_row->>'session_id')::UUID;
    v_task_id := (v_old_row->>'task_id')::UUID;
  END IF;
  
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
    v_entity_type,
    v_entity_id,
    v_event_type,
    v_changed_fields,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME
    ),
    v_student_id,
    v_staff_id,
    v_class_id,
    v_session_id,
    v_task_id,
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
        AND entity_type = v_entity_type
        AND v_event_type = ANY(event_types)
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
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.create_activity_event() IS 'Creates activity events and triggers automation processing if matching rules exist. Includes optimization to avoid HTTP calls when no rules match.';

