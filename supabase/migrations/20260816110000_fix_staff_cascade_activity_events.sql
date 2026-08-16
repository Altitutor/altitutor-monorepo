-- Preserve activity snapshots when deleting staff with cascading assignments.
-- A child DELETE trigger cannot retain a live staff_id foreign key because the
-- parent staff row is already absent when the activity event is inserted.

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
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_class_id := NEW.class_id;
    v_staff_id := NEW.staff_id;
  ELSE
    v_class_id := NULL;
    v_staff_id := NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF NOT v_field_name = ANY(v_excluded_fields)
         AND (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
        v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
          v_field_name,
          jsonb_build_object(
            'old', to_jsonb(OLD)->v_field_name,
            'new', to_jsonb(NEW)->v_field_name
          )
        );
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
      'deleted_class_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.class_id ELSE NULL END,
      'deleted_staff_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.staff_id ELSE NULL END
    ),
    p_staff_id := v_staff_id,
    p_class_id := v_class_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.extract_activity_fks_sessions_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_staff_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('sessions_staff');
  v_field_name TEXT;
  v_event_type TEXT;
  v_session_name TEXT;
  v_assignment_source TEXT := NULLIF(
    current_setting('app.sessions_staff_assignment_source', true),
    ''
  );
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_staff_id := NEW.staff_id;
  ELSE
    v_session_id := NULL;
    v_staff_id := NULL;

    SELECT COALESCE(NULLIF(trim(s.long_name), ''), NULLIF(trim(s.short_name), ''))
    INTO v_session_name
    FROM public.sessions s
    WHERE s.id = OLD.session_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF NOT v_field_name = ANY(v_excluded_fields)
         AND (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
        v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
          v_field_name,
          jsonb_build_object(
            'old', to_jsonb(OLD)->v_field_name,
            'new', to_jsonb(NEW)->v_field_name
          )
        );
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
    p_metadata := jsonb_strip_nulls(jsonb_build_object(
      'operation', TG_OP,
      'table', 'sessions_staff',
      'assignment_source', v_assignment_source,
      'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NULL END,
      'deleted_staff_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.staff_id ELSE NULL END,
      'session_name', CASE WHEN TG_OP = 'DELETE' THEN v_session_name ELSE NULL END
    )),
    p_staff_id := v_staff_id,
    p_session_id := v_session_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_staff_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tutor_log_id UUID;
  v_staff_id UUID;
  v_session_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] :=
    public.get_excluded_fields_for_table('tutor_logs_staff_attendance');
  v_field_name TEXT;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_tutor_log_id := NEW.tutor_log_id;
    v_staff_id := NEW.staff_id;
  ELSE
    v_tutor_log_id := OLD.tutor_log_id;
    v_staff_id := NULL;
  END IF;

  SELECT session_id
  INTO v_session_id
  FROM public.tutor_logs
  WHERE id = v_tutor_log_id;

  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF NOT v_field_name = ANY(v_excluded_fields)
         AND (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
        v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
          v_field_name,
          jsonb_build_object(
            'old', to_jsonb(OLD)->v_field_name,
            'new', to_jsonb(NEW)->v_field_name
          )
        );
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
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'tutor_logs_staff_attendance',
      'deleted_staff_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.staff_id ELSE NULL END
    ),
    p_staff_id := v_staff_id,
    p_session_id := v_session_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

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
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_admin_shift_id := NEW.admin_shift_id;
    v_staff_id := NEW.staff_id;
  ELSE
    v_admin_shift_id := OLD.admin_shift_id;
    v_staff_id := NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF NOT v_field_name = ANY(v_excluded_fields)
         AND (to_jsonb(OLD)->>v_field_name) IS DISTINCT FROM (to_jsonb(NEW)->>v_field_name) THEN
        v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
          v_field_name,
          jsonb_build_object(
            'old', to_jsonb(OLD)->v_field_name,
            'new', to_jsonb(NEW)->v_field_name
          )
        );
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
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'admin_shifts_staff',
      'deleted_staff_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.staff_id ELSE NULL END
    ),
    p_staff_id := v_staff_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
