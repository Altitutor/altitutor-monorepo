-- Persist subject/staff context on students_subjects activity events so the
-- activity feed can show subject names (and staff) after the join row is deleted.

CREATE OR REPLACE FUNCTION public.extract_activity_fks_students_subjects()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID;
  v_subject_id UUID;
  v_created_by UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('students_subjects');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP = 'DELETE' THEN
    -- Null student FK on DELETE to avoid cascade-delete FK violations when the
    -- parent student row is removed; keep IDs in metadata for display.
    v_student_id := NULL;
    v_subject_id := OLD.subject_id;
    v_created_by := OLD.created_by;
  ELSE
    v_student_id := NEW.student_id;
    v_subject_id := NEW.subject_id;
    v_created_by := NEW.created_by;
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
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'students_subjects',
      'subject_id', v_subject_id,
      'created_by', v_created_by,
      'student_id', COALESCE(NEW.student_id, OLD.student_id),
      'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NULL END
    ),
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

COMMENT ON FUNCTION public.extract_activity_fks_students_subjects IS
  'Activity events trigger for students_subjects. Stores subject_id/created_by/student_id in metadata for feed display; nulls student_id FK on DELETE to avoid cascade FK violations.';
