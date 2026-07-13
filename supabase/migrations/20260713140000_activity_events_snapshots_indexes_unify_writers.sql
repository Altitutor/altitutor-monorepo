-- Migration: Activity events snapshots, indexes, exclude note body, unify writers
-- Description:
--   1) Exclude TipTap note body / search_vector from notes activity payloads
--   2) Add composite indexes for common feed filters + performed_at
--   3) Extend log_activity_event with issue_id/project_id and display-name snapshots
--   4) Route notes / sessions_students / tasks / issues / projects through the central writer
-- Author: AI Assistant
-- Date: 2026-07-13

-- ========================
-- 1) Field exclusions (notes TipTap body)
-- ========================

CREATE OR REPLACE FUNCTION public.get_excluded_fields_for_table(table_name text)
RETURNS text[]
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE table_name
    WHEN 'invoices' THEN ARRAY[
      'created_at', 'updated_at', 'created_by',
      'stripe_invoice_id', 'stripe_invoice_number', 'stripe_charge_id',
      'stripe_payment_intent_id', 'receipt_url', 'hosted_invoice_url', 'invoice_pdf',
      'dispute_id', 'dispute_status', 'dispute_reason', 'dispute_amount_cents',
      'dispute_currency', 'dispute_created_at', 'dispute_updated_at', 'dispute_resolved_at',
      'finalized_at', 'paid_at'
    ]
    WHEN 'invoice_items' THEN ARRAY['created_at', 'stripe_invoice_item_id']
    WHEN 'credit_notes' THEN ARRAY['created_at', 'updated_at', 'stripe_credit_note_id']
    WHEN 'tasks' THEN ARRAY[
      'created_at', 'updated_at', 'created_by', 'description', 'search_vector',
      'source_rule_id', 'source_activity_id'
    ]
    WHEN 'issues' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector']
    WHEN 'projects' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector']
    WHEN 'notes' THEN ARRAY['created_at', 'updated_at', 'created_by', 'note', 'search_vector']
    ELSE ARRAY['created_at', 'updated_at', 'created_by']
  END;
END;
$$;

-- ========================
-- 2) Composite indexes for feed queries
-- ========================

CREATE INDEX IF NOT EXISTS idx_activity_student_performed_at
  ON public.activity_events (student_id, performed_at DESC)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_session_performed_at
  ON public.activity_events (session_id, performed_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_staff_performed_at
  ON public.activity_events (staff_id, performed_at DESC)
  WHERE staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_performed_by_performed_at
  ON public.activity_events (performed_by, performed_at DESC)
  WHERE performed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_class_performed_at
  ON public.activity_events (class_id, performed_at DESC)
  WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_parent_performed_at
  ON public.activity_events (parent_id, performed_at DESC)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_task_performed_at
  ON public.activity_events (task_id, performed_at DESC)
  WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_issue_performed_at
  ON public.activity_events (issue_id, performed_at DESC)
  WHERE issue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_project_performed_at
  ON public.activity_events (project_id, performed_at DESC)
  WHERE project_id IS NOT NULL;

-- ========================
-- 3) Central writer: issue/project FKs + display snapshots
-- ========================

DROP FUNCTION IF EXISTS public.log_activity_event(
  text, uuid, text, jsonb, jsonb, uuid, uuid, uuid, uuid, uuid, uuid
);

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
  p_parent_id UUID DEFAULT NULL,
  p_issue_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL
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
  v_metadata JSONB;
  v_display JSONB := '{}'::JSONB;
  v_name TEXT;
  v_subject_id UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;

  v_metadata := COALESCE(
    p_metadata,
    jsonb_build_object('operation', 'UNKNOWN', 'table', p_entity_type)
  );

  -- Snapshot display labels at write time so feeds can render without live joins.
  IF v_performed_by IS NOT NULL THEN
    SELECT trim(both FROM concat_ws(' ', s.first_name, s.last_name))
    INTO v_name
    FROM public.staff s
    WHERE s.id = v_performed_by;
    IF v_name IS NOT NULL AND v_name <> '' THEN
      v_display := v_display || jsonb_build_object('performed_by_name', v_name);
    END IF;
  END IF;

  IF p_student_id IS NOT NULL THEN
    SELECT trim(both FROM concat_ws(' ', st.first_name, st.last_name))
    INTO v_name
    FROM public.students st
    WHERE st.id = p_student_id;
    IF v_name IS NOT NULL AND v_name <> '' THEN
      v_display := v_display || jsonb_build_object('student_name', v_name);
    END IF;
  END IF;

  IF p_staff_id IS NOT NULL THEN
    SELECT trim(both FROM concat_ws(' ', s.first_name, s.last_name))
    INTO v_name
    FROM public.staff s
    WHERE s.id = p_staff_id;
    IF v_name IS NOT NULL AND v_name <> '' THEN
      v_display := v_display || jsonb_build_object('staff_name', v_name);
    END IF;
  END IF;

  IF p_class_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(c.long_name), ''), NULLIF(trim(c.short_name), ''))
    INTO v_name
    FROM public.classes c
    WHERE c.id = p_class_id;
    IF v_name IS NOT NULL THEN
      v_display := v_display || jsonb_build_object('class_name', v_name);
    END IF;
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(se.long_name), ''), NULLIF(trim(se.short_name), ''))
    INTO v_name
    FROM public.sessions se
    WHERE se.id = p_session_id;
    IF v_name IS NOT NULL THEN
      v_display := v_display || jsonb_build_object('session_name', v_name);
    END IF;
  END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT trim(both FROM concat_ws(' ', p.first_name, p.last_name))
    INTO v_name
    FROM public.parents p
    WHERE p.id = p_parent_id;
    IF v_name IS NOT NULL AND v_name <> '' THEN
      v_display := v_display || jsonb_build_object('parent_name', v_name);
    END IF;
  END IF;

  IF p_task_id IS NOT NULL OR (p_entity_type = 'tasks' AND p_entity_id IS NOT NULL) THEN
    SELECT t.title
    INTO v_name
    FROM public.tasks t
    WHERE t.id = COALESCE(p_task_id, CASE WHEN p_entity_type = 'tasks' THEN p_entity_id ELSE NULL END);
    IF v_name IS NOT NULL AND v_name <> '' THEN
      v_display := v_display || jsonb_build_object('task_title', v_name);
    END IF;
  END IF;

  IF p_issue_id IS NOT NULL OR (p_entity_type = 'issues' AND p_entity_id IS NOT NULL) THEN
    SELECT i.name
    INTO v_name
    FROM public.issues i
    WHERE i.id = COALESCE(p_issue_id, CASE WHEN p_entity_type = 'issues' THEN p_entity_id ELSE NULL END);
    IF v_name IS NOT NULL AND v_name <> '' THEN
      v_display := v_display || jsonb_build_object('issue_name', v_name);
    END IF;
  END IF;

  IF p_project_id IS NOT NULL OR (p_entity_type = 'projects' AND p_entity_id IS NOT NULL) THEN
    SELECT pr.name
    INTO v_name
    FROM public.projects pr
    WHERE pr.id = COALESCE(p_project_id, CASE WHEN p_entity_type = 'projects' THEN p_entity_id ELSE NULL END);
    IF v_name IS NOT NULL AND v_name <> '' THEN
      v_display := v_display || jsonb_build_object('project_name', v_name);
    END IF;
  END IF;

  -- Resolve subject / deleted student names from metadata when FK columns are null.
  v_subject_id := NULLIF(v_metadata->>'subject_id', '')::UUID;
  IF v_subject_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(trim(sub.long_name), ''), NULLIF(trim(sub.short_name), ''), NULLIF(trim(sub.name), ''))
    INTO v_name
    FROM public.subjects sub
    WHERE sub.id = v_subject_id;
    IF v_name IS NOT NULL THEN
      v_display := v_display || jsonb_build_object('subject_name', v_name);
    END IF;
  END IF;

  IF p_student_id IS NULL AND (v_display->>'student_name') IS NULL THEN
    BEGIN
      SELECT trim(both FROM concat_ws(' ', st.first_name, st.last_name))
      INTO v_name
      FROM public.students st
      WHERE st.id = COALESCE(
        NULLIF(v_metadata->>'student_id', '')::UUID,
        NULLIF(v_metadata->>'deleted_student_id', '')::UUID
      );
      IF v_name IS NOT NULL AND v_name <> '' THEN
        v_display := v_display || jsonb_build_object('student_name', v_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- ignore invalid UUID text in metadata
    END;
  END IF;

  IF p_entity_type = 'tutor_logs_topics' AND p_entity_id IS NOT NULL THEN
    SELECT t.name
    INTO v_name
    FROM public.tutor_logs_topics tlt
    JOIN public.topics t ON t.id = tlt.topic_id
    WHERE tlt.id = p_entity_id;
    IF v_name IS NOT NULL AND v_name <> '' THEN
      v_display := v_display || jsonb_build_object('topic_name', v_name);
    END IF;
  END IF;

  IF v_display <> '{}'::JSONB THEN
    v_metadata := v_metadata || jsonb_build_object('display', v_display);
  END IF;

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
    issue_id,
    project_id,
    performed_by,
    performed_at
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_event_type,
    p_changed_fields,
    v_metadata,
    p_student_id,
    p_staff_id,
    p_class_id,
    p_session_id,
    p_task_id,
    p_parent_id,
    p_issue_id,
    p_project_id,
    v_performed_by,
    NOW()
  )
  RETURNING id INTO v_activity_id;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.automation_rules
      WHERE enabled = true
        AND entity_type = p_entity_type
        AND p_event_type = ANY(event_types)
    ) INTO v_has_matching_rules;

    IF v_has_matching_rules THEN
      BEGIN
        v_supabase_url := public.get_supabase_url();
        v_service_key := public.get_service_role_key();

        IF v_supabase_url IS NOT NULL AND v_supabase_url != ''
           AND v_service_key IS NOT NULL AND v_service_key != '' THEN
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
        RAISE WARNING 'Failed to call activity-processor edge function for activity %: %', v_activity_id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN v_activity_id;
END;
$$;

COMMENT ON FUNCTION public.log_activity_event IS
  'Central activity logger: inserts activity_events (with display-name snapshots), then optionally invokes activity-processor when automation rules match.';

-- ========================
-- 4) Unify writers through log_activity_event
-- ========================

CREATE OR REPLACE FUNCTION public.extract_activity_fks_sessions_students()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id UUID := NULL;
  v_student_id UUID := NULL;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('sessions_students');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_student_id := NEW.student_id;
  ELSE
    v_session_id := NULL;
    v_student_id := NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      v_field_excluded := v_field_name = ANY(v_excluded_fields);
      IF NOT v_field_excluded THEN
        IF (to_jsonb(OLD) ->> v_field_name) IS DISTINCT FROM (to_jsonb(NEW) ->> v_field_name) THEN
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
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'sessions_students',
      'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NULL END,
      'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.student_id ELSE NULL END
    ),
    p_student_id := v_student_id,
    p_session_id := v_session_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

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
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_target_type := NEW.target_type;
    v_target_id   := NEW.target_id;
  ELSE
    v_target_type := OLD.target_type;
    v_target_id   := OLD.target_id;
  END IF;

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

  PERFORM public.log_activity_event(
    p_entity_type := 'notes',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'notes',
      'target_type', v_target_type,
      'target_id', v_target_id,
      'deleted_student_id', CASE
        WHEN TG_OP = 'DELETE' AND v_target_type IN ('student', 'students') THEN v_target_id
        ELSE NULL
      END
    ),
    p_student_id := v_student_id,
    p_staff_id := v_staff_id,
    p_class_id := v_class_id,
    p_session_id := v_session_id,
    p_parent_id := v_parent_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

COMMENT ON FUNCTION public.extract_activity_fks_notes IS
  'Activity events trigger for notes. Uses log_activity_event; excludes TipTap note body from changed_fields; nulls target FKs on DELETE.';

CREATE OR REPLACE FUNCTION public.extract_activity_fks_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_student_id UUID := NULL;
  v_staff_id UUID := NULL;
  v_class_id UUID := NULL;
  v_session_id UUID := NULL;
  v_task_id UUID := NULL;
  v_issue_id UUID := NULL;
  v_project_id UUID := NULL;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('tasks');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_task_id := NEW.id;
    v_staff_id := NEW.assigned_to;
    v_issue_id := NEW.issue_id;
    v_project_id := NEW.project_id;
  ELSE
    v_task_id := NULL;
    v_staff_id := OLD.assigned_to;
    v_issue_id := OLD.issue_id;
    v_project_id := OLD.project_id;
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
    p_entity_type := 'tasks',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'tasks',
      'deleted_task_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END
    ),
    p_student_id := v_student_id,
    p_staff_id := v_staff_id,
    p_class_id := v_class_id,
    p_session_id := v_session_id,
    p_task_id := v_task_id,
    p_issue_id := v_issue_id,
    p_project_id := v_project_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.extract_activity_fks_issues()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_issue_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('issues');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_issue_id := NEW.id;
  ELSE
    v_issue_id := NULL;
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
    p_entity_type := 'issues',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'issues',
      'deleted_issue_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END
    ),
    p_issue_id := v_issue_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.extract_activity_fks_projects()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_project_id UUID;
  v_changed_fields JSONB := NULL;
  v_excluded_fields TEXT[] := public.get_excluded_fields_for_table('projects');
  v_field_name TEXT;
  v_field_excluded BOOLEAN;
  v_event_type TEXT;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'CREATED'
    WHEN TG_OP = 'UPDATE' THEN 'UPDATED'
    ELSE 'DELETED'
  END;

  IF TG_OP != 'DELETE' THEN
    v_project_id := NEW.id;
  ELSE
    v_project_id := NULL;
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
    p_entity_type := 'projects',
    p_entity_id := COALESCE(NEW.id, OLD.id),
    p_event_type := v_event_type,
    p_changed_fields := v_changed_fields,
    p_metadata := jsonb_build_object(
      'operation', TG_OP,
      'table', 'projects',
      'deleted_project_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END
    ),
    p_project_id := v_project_id
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
