-- Migration: Fix activity_events foreign key constraint violation on student cascade deletes
-- Description:
--   When students are deleted, cascade deletes occur on related tables (sessions_students,
--   students_subjects, invoices, parents_students, etc.). The activity_events triggers for
--   these tables were inserting activity rows that still referenced the student_id being
--   deleted, causing foreign key constraint violations on activity_events_student_id_fkey.
--
--   This migration updates the affected trigger functions to:
--   1. Set student_id to NULL on DELETE operations (avoiding FK constraint violations)
--   2. Store the deleted student_id in metadata for audit trail purposes
--
--   This matches the pattern already used for session_id and class_id cascade deletes.
-- Author: AI Assistant
-- Date: 2026-07-13

-- ========================
-- FIX sessions_students
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
    -- Null both FKs on DELETE: parent session or student may be mid-cascade-delete
    v_session_id := NULL;
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
      'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NULL END,
      'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NULL END
    ),
    v_student_id, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ========================
-- FIX classes_students
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
    -- Null both FKs on DELETE: parent class or student may be mid-cascade-delete
    v_class_id := NULL;
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
    p_entity_type := 'classes_students',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'classes_students',
      'deleted_class_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.class_id ELSE NULL END,
      'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NULL END
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
-- FIX parents_students
-- ========================

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
    p_entity_type := 'parents_students',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'parents_students',
      'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NULL END
    ),
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

-- ========================
-- FIX invoices
-- ========================

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
    p_entity_type := 'invoices',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'invoices',
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

-- ========================
-- FIX student_subsidies
-- ========================

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
    p_entity_type := 'student_subsidies',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'student_subsidies',
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

-- ========================
-- FIX students_subjects
-- ========================

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
    p_entity_type := 'students_subjects',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'students_subjects',
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

-- ========================
-- FIX tutor_logs_student_attendance
-- ========================

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
    v_student_id := NULL;
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
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'tutor_logs_student_attendance',
      'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NULL END
    ),
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

-- ========================
-- FIX tutor_logs_topics_files_students
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_topics_files_students()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
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
    v_student_id := NULL;
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
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'tutor_logs_topics_files_students',
      'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NULL END
    ),
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

-- ========================
-- FIX tutor_logs_topics_students
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_tutor_logs_topics_students()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
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
    v_student_id := NULL;
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
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'tutor_logs_topics_students',
      'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NULL END
    ),
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

-- ========================
-- FIX notes (polymorphic student target)
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;

  IF TG_OP != 'DELETE' THEN
    v_target_type := NEW.target_type;
    v_target_id   := NEW.target_id;
  ELSE
    v_target_type := OLD.target_type;
    v_target_id   := OLD.target_id;
  END IF;

  -- Only set live FKs on INSERT/UPDATE. On DELETE, leave them NULL to avoid
  -- FK violations when the target entity is mid-cascade-delete.
  IF TG_OP != 'DELETE' THEN
    IF v_target_type IN ('student', 'students') THEN
      v_student_id := v_target_id;
    ELSIF v_target_type = 'staff' THEN
      v_staff_id := v_target_id;
    ELSIF v_target_type IN ('parent', 'parents') THEN
      v_parent_id := v_target_id;
    ELSIF v_target_type IN ('class', 'classes') THEN
      v_class_id := v_target_id;
    ELSIF v_target_type IN ('session', 'sessions') THEN
      v_session_id := v_target_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      v_field_excluded := v_field_name = ANY(v_excluded_fields);
      IF NOT v_field_excluded THEN
        IF (to_jsonb(OLD) ->> v_field_name) IS DISTINCT FROM (to_jsonb(NEW) ->> v_field_name) THEN
          v_changed_fields := COALESCE(v_changed_fields, '{}'::JSONB) || jsonb_build_object(
            v_field_name,
            jsonb_build_object(
              'old', to_jsonb(OLD) -> v_field_name,
              'new', to_jsonb(NEW) -> v_field_name
            )
          );
        END IF;
      END IF;
    END LOOP;
    IF v_changed_fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'notes',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object(
      'operation', TG_OP,
      'table', 'notes',
      'target_type', v_target_type,
      'target_id', v_target_id,
      'deleted_student_id', CASE
        WHEN TG_OP = 'DELETE' AND v_target_type IN ('student', 'students') THEN v_target_id
        ELSE NULL
      END
    ),
    v_student_id, v_staff_id, v_class_id, v_session_id, NULL, v_parent_id,
    v_performed_by, NOW()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

COMMENT ON FUNCTION public.extract_activity_fks_sessions_students IS
  'Activity events trigger for sessions_students. Nulls session_id and student_id on DELETE to avoid FK violations during cascade deletes; stores deleted IDs in metadata.';
COMMENT ON FUNCTION public.extract_activity_fks_classes_students IS
  'Activity events trigger for classes_students. Nulls class_id and student_id on DELETE to avoid FK violations during cascade deletes; stores deleted IDs in metadata.';
COMMENT ON FUNCTION public.extract_activity_fks_parents_students IS
  'Activity events trigger for parents_students. Nulls student_id on DELETE to avoid FK violations when students are cascade deleted.';
COMMENT ON FUNCTION public.extract_activity_fks_invoices IS
  'Activity events trigger for invoices. Nulls student_id on DELETE to avoid FK violations when students are cascade deleted.';
COMMENT ON FUNCTION public.extract_activity_fks_student_subsidies IS
  'Activity events trigger for student_subsidies. Nulls student_id on DELETE to avoid FK violations when students are cascade deleted.';
COMMENT ON FUNCTION public.extract_activity_fks_students_subjects IS
  'Activity events trigger for students_subjects. Nulls student_id on DELETE to avoid FK violations when students are cascade deleted.';
COMMENT ON FUNCTION public.extract_activity_fks_tutor_logs_student_attendance IS
  'Activity events trigger for tutor_logs_student_attendance. Nulls student_id on DELETE to avoid FK violations when students are cascade deleted.';
COMMENT ON FUNCTION public.extract_activity_fks_tutor_logs_topics_files_students IS
  'Activity events trigger for tutor_logs_topics_files_students. Nulls student_id on DELETE to avoid FK violations when students are cascade deleted.';
COMMENT ON FUNCTION public.extract_activity_fks_tutor_logs_topics_students IS
  'Activity events trigger for tutor_logs_topics_students. Nulls student_id on DELETE to avoid FK violations when students are cascade deleted.';
COMMENT ON FUNCTION public.extract_activity_fks_notes IS
  'Activity events trigger for notes. Nulls target FKs on DELETE to avoid FK violations when the target entity is cascade deleted.';
