-- Migration: Create Activity Events System
-- Description: Create centralized activity_events table with triggers on 26 core entity tables
--              to capture all changes for activity feeds, audit trails, and automation triggers
-- Author: AI Assistant
-- Date: 2026-01-09
-- Related Issue: ALTI-124

-- ========================
-- CREATE activity_events TABLE
-- ========================

CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL, -- 'sessions', 'students', 'classes', 'tasks', etc.
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED', 'DELETED', 'FIELD_CHANGED')),
  changed_fields JSONB, -- For UPDATE: {"status": {"old": "draft", "new": "confirmed"}}
  metadata JSONB, -- Additional context (who, what, when details)
  
  -- Denormalized foreign keys for easy filtering
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.parents(id) ON DELETE SET NULL,
  
  -- Audit fields
  performed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL, -- Who did it (from auth context)
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- CREATE INDEXES
-- ========================

CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activity_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_performed_at ON public.activity_events(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_student ON public.activity_events(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_staff ON public.activity_events(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_class ON public.activity_events(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_session ON public.activity_events(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_task ON public.activity_events(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_parent ON public.activity_events(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_performed_by ON public.activity_events(performed_by) WHERE performed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_event_type ON public.activity_events(event_type);

-- ========================
-- CREATE GENERIC TRIGGER FUNCTION
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
    
    -- Build changed_fields JSONB for UPDATE events
    FOR v_field_name IN SELECT jsonb_object_keys(v_new_row) LOOP
      IF v_old_row->>v_field_name IS DISTINCT FROM v_new_row->>v_field_name THEN
        v_field_changes := v_field_changes || jsonb_build_object(
          v_field_name,
          jsonb_build_object(
            'old', v_old_row->v_field_name,
            'new', v_new_row->v_field_name
          )
        );
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
  
  -- Insert activity event
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
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ========================
-- TABLE-SPECIFIC FOREIGN KEY EXTRACTION FUNCTIONS
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_task_id := NEW.id;
    v_staff_id := NEW.assigned_to;
  ELSE
    -- For DELETE, store the task_id in entity_id but set FK to NULL to avoid constraint violation
    -- The entity_id will preserve the deleted task's ID for reference
    v_task_id := NULL; -- Set to NULL to avoid FK constraint violation
    v_staff_id := OLD.assigned_to;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type,
    changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'tasks',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'tasks', 'deleted_task_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    v_student_id, v_staff_id, v_class_id, v_session_id, v_task_id, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
  v_changed_fields JSONB := NULL;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_class_id := NEW.id;
    IF TG_OP = 'UPDATE' THEN
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      INTO v_changed_fields
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val;
    END IF;
  ELSE
    -- For DELETE, set FK to NULL to avoid constraint violation
    v_class_id := NULL;
  END IF;
  
  -- Skip if no changes in UPDATE
  IF TG_OP = 'UPDATE' AND v_changed_fields IS NULL THEN
    RETURN NEW;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'classes', COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    v_changed_fields,
    jsonb_build_object('operation', TG_OP, 'table', 'classes', 'deleted_class_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    NULL, NULL, v_class_id, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_class_id := NEW.class_id;
    v_staff_id := NEW.staff_id;
  ELSE
    v_class_id := OLD.class_id;
    v_staff_id := OLD.staff_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'classes_staff',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'classes_staff'),
    NULL, v_staff_id, v_class_id, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_class_id := NEW.class_id;
    v_student_id := NEW.student_id;
  ELSE
    v_class_id := OLD.class_id;
    v_student_id := OLD.student_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'classes_students',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'classes_students'),
    v_student_id, NULL, v_class_id, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.id;
    v_class_id := NEW.class_id;
  ELSE
    -- For DELETE, set FKs to NULL to avoid constraint violations
    -- Store deleted IDs in metadata instead
    v_session_id := NULL;
    v_class_id := OLD.class_id; -- class_id can stay since classes aren't being deleted
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'sessions', COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'sessions', 'deleted_session_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    NULL, NULL, v_class_id, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_student_id := NEW.student_id;
  ELSE
    v_session_id := OLD.session_id;
    v_student_id := OLD.student_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'sessions_students',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'sessions_students'),
    v_student_id, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
    v_staff_id := NEW.staff_id;
  ELSE
    v_session_id := OLD.session_id;
    v_staff_id := OLD.staff_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'sessions_staff',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'sessions_staff'),
    NULL, v_staff_id, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
  ELSE
    v_session_id := OLD.session_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'sessions_files',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'sessions_files'),
    NULL, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.id;
  ELSE
    -- For DELETE, set FK to NULL to avoid constraint violation
    v_student_id := NULL;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'students', COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'students', 'deleted_student_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    v_student_id, NULL, NULL, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_staff_id := NEW.id;
  ELSE
    -- For DELETE, set FK to NULL to avoid constraint violation
    v_staff_id := NULL;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'staff', COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'staff', 'deleted_staff_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    NULL, v_staff_id, NULL, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_parent_id := NEW.id;
  ELSE
    -- For DELETE, set FK to NULL to avoid constraint violation
    v_parent_id := NULL;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'parents',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'parents', 'deleted_parent_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    NULL, NULL, NULL, NULL, NULL, v_parent_id,
    v_performed_by, NOW()
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
  v_student_id UUID;
  v_parent_id UUID;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
    v_parent_id := NEW.parent_id;
  ELSE
    v_student_id := OLD.student_id;
    v_parent_id := OLD.parent_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'parents_students',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'parents_students'),
    v_student_id, NULL, NULL, NULL, NULL, v_parent_id,
    v_performed_by, NOW()
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for messages table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_id UUID := NULL;
  v_staff_id UUID := NULL;
  v_parent_id UUID := NULL;
  v_performed_by UUID;
  v_conversation_id UUID;
  v_contact_id UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  -- Extract conversation_id
  IF TG_OP != 'DELETE' THEN
    v_conversation_id := NEW.conversation_id;
  ELSE
    v_conversation_id := OLD.conversation_id;
  END IF;
  
  -- Get contact_id from conversation
  SELECT contact_id INTO v_contact_id FROM public.conversations WHERE id = v_conversation_id;
  
  -- Extract student_id, parent_id, or staff_id from contact
  IF v_contact_id IS NOT NULL THEN
    SELECT student_id, parent_id, staff_id INTO v_student_id, v_parent_id, v_staff_id
    FROM public.contacts WHERE id = v_contact_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'messages',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'messages', 'conversation_id', v_conversation_id, 'contact_id', v_contact_id),
    v_student_id, v_staff_id, NULL, NULL, NULL, v_parent_id,
    v_performed_by, NOW()
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Helper function for conversation_reads table
CREATE OR REPLACE FUNCTION public.extract_activity_fks_conversation_reads()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'conversation_reads',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'conversation_reads'),
    NULL, NULL, NULL, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
  ELSE
    v_student_id := OLD.student_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'invoices',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'invoices'),
    v_student_id, NULL, NULL, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_student_id UUID;
  v_session_id UUID;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    -- Extract direct FKs from invoice_items
    v_student_id := NEW.student_id;
    v_session_id := NEW.session_id;
  ELSE
    -- For DELETE, set FKs to NULL to avoid constraint violations
    v_student_id := NULL;
    v_session_id := NULL;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'invoice_items',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'invoice_items', 'deleted_invoice_item_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NULL END),
    v_student_id, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  -- Extract target_type and target_id
  IF TG_OP != 'DELETE' THEN
    v_target_type := NEW.target_type;
    v_target_id := NEW.target_id;
  ELSE
    v_target_type := OLD.target_type;
    v_target_id := OLD.target_id;
  END IF;
  
  -- Extract appropriate FK based on target_type
  CASE v_target_type
    WHEN 'student' THEN
      v_student_id := v_target_id;
    WHEN 'staff' THEN
      v_staff_id := v_target_id;
    WHEN 'parent' THEN
      v_parent_id := v_target_id;
    WHEN 'class' THEN
      v_class_id := v_target_id;
    WHEN 'session' THEN
      v_session_id := v_target_id;
    -- Add more cases as needed for other target types
    ELSE
      -- Unknown target_type, leave all FKs as NULL
      NULL;
  END CASE;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'notes',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'notes', 'target_type', v_target_type, 'target_id', v_target_id),
    v_student_id, v_staff_id, v_class_id, v_session_id, NULL, v_parent_id,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
  ELSE
    v_student_id := OLD.student_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'student_subsidies',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'student_subsidies'),
    v_student_id, NULL, NULL, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
  ELSE
    v_student_id := OLD.student_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'students_subjects',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'students_subjects'),
    v_student_id, NULL, NULL, NULL, NULL, NULL,
    v_performed_by, NOW()
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
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_session_id := NEW.session_id;
  ELSE
    v_session_id := OLD.session_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'tutor_logs',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs'),
    NULL, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_session_id UUID;
  v_staff_id UUID;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    -- Extract direct FK: staff_id from tutor_logs_staff_attendance table
    v_staff_id := NEW.staff_id;
    -- Extract indirect FK: session_id via tutor_logs
    SELECT tl.session_id INTO v_session_id
    FROM public.tutor_logs tl WHERE tl.id = NEW.tutor_log_id;
  ELSE
    -- Extract direct FK: staff_id from tutor_logs_staff_attendance table
    v_staff_id := OLD.staff_id;
    -- Extract indirect FK: session_id via tutor_logs
    SELECT tl.session_id INTO v_session_id
    FROM public.tutor_logs tl WHERE tl.id = OLD.tutor_log_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'tutor_logs_staff_attendance',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_staff_attendance'),
    NULL, v_staff_id, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_session_id UUID;
  v_student_id UUID;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    v_student_id := NEW.student_id;
    SELECT tl.session_id INTO v_session_id FROM public.tutor_logs tl WHERE tl.id = NEW.tutor_log_id;
  ELSE
    v_student_id := OLD.student_id;
    SELECT tl.session_id INTO v_session_id FROM public.tutor_logs tl WHERE tl.id = OLD.tutor_log_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'tutor_logs_student_attendance',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_student_attendance'),
    v_student_id, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_session_id UUID;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    SELECT tl.session_id INTO v_session_id FROM public.tutor_logs tl WHERE tl.id = NEW.tutor_log_id;
  ELSE
    SELECT tl.session_id INTO v_session_id FROM public.tutor_logs tl WHERE tl.id = OLD.tutor_log_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'tutor_logs_topics',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_topics'),
    NULL, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_session_id UUID;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
  IF TG_OP != 'DELETE' THEN
    SELECT tl.session_id INTO v_session_id FROM public.tutor_logs tl WHERE tl.id = NEW.tutor_log_id;
  ELSE
    SELECT tl.session_id INTO v_session_id FROM public.tutor_logs tl WHERE tl.id = OLD.tutor_log_id;
  END IF;
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'tutor_logs_topics_files',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_topics_files'),
    NULL, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_session_id UUID;
  v_student_id UUID;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
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
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'tutor_logs_topics_files_students',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_topics_files_students'),
    v_student_id, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
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
  v_session_id UUID;
  v_student_id UUID;
  v_performed_by UUID;
BEGIN
  SELECT public.current_staff_id() INTO v_performed_by;
  
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
  
  INSERT INTO public.activity_events (
    entity_type, entity_id, event_type, changed_fields, metadata,
    student_id, staff_id, class_id, session_id, task_id, parent_id,
    performed_by, performed_at
  ) VALUES (
    'tutor_logs_topics_students',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' WHEN TG_OP = 'UPDATE' THEN 'UPDATED' ELSE 'DELETED' END,
    CASE WHEN TG_OP = 'UPDATE' THEN (
      SELECT jsonb_object_agg(old_rec.key, jsonb_build_object('old', old_val, 'new', new_val))
      FROM jsonb_each(to_jsonb(OLD)) old_rec(key, old_val)
      JOIN jsonb_each(to_jsonb(NEW)) new_rec(key, new_val) ON old_rec.key = new_rec.key
      WHERE old_val IS DISTINCT FROM new_val
    ) ELSE NULL END,
    jsonb_build_object('operation', TG_OP, 'table', 'tutor_logs_topics_students'),
    v_student_id, NULL, NULL, v_session_id, NULL, NULL,
    v_performed_by, NOW()
  );
  
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ========================
-- CREATE TRIGGERS FOR ALL TABLES
-- ========================

-- Tasks table
DROP TRIGGER IF EXISTS trigger_activity_events_tasks ON public.tasks;
CREATE TRIGGER trigger_activity_events_tasks
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_tasks();

-- Classes table
DROP TRIGGER IF EXISTS trigger_activity_events_classes ON public.classes;
CREATE TRIGGER trigger_activity_events_classes
AFTER INSERT OR UPDATE OR DELETE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_classes();

-- Classes_staff table
DROP TRIGGER IF EXISTS trigger_activity_events_classes_staff ON public.classes_staff;
CREATE TRIGGER trigger_activity_events_classes_staff
AFTER INSERT OR UPDATE OR DELETE ON public.classes_staff
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_classes_staff();

-- Classes_students table
DROP TRIGGER IF EXISTS trigger_activity_events_classes_students ON public.classes_students;
CREATE TRIGGER trigger_activity_events_classes_students
AFTER INSERT OR UPDATE OR DELETE ON public.classes_students
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_classes_students();

-- Sessions table
DROP TRIGGER IF EXISTS trigger_activity_events_sessions ON public.sessions;
CREATE TRIGGER trigger_activity_events_sessions
AFTER INSERT OR UPDATE OR DELETE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_sessions();

-- Sessions_students table
DROP TRIGGER IF EXISTS trigger_activity_events_sessions_students ON public.sessions_students;
CREATE TRIGGER trigger_activity_events_sessions_students
AFTER INSERT OR UPDATE OR DELETE ON public.sessions_students
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_sessions_students();

-- Sessions_staff table
DROP TRIGGER IF EXISTS trigger_activity_events_sessions_staff ON public.sessions_staff;
CREATE TRIGGER trigger_activity_events_sessions_staff
AFTER INSERT OR UPDATE OR DELETE ON public.sessions_staff
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_sessions_staff();

-- Sessions_files table
DROP TRIGGER IF EXISTS trigger_activity_events_sessions_files ON public.sessions_files;
CREATE TRIGGER trigger_activity_events_sessions_files
AFTER INSERT OR UPDATE OR DELETE ON public.sessions_files
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_sessions_files();

-- Students table
DROP TRIGGER IF EXISTS trigger_activity_events_students ON public.students;
CREATE TRIGGER trigger_activity_events_students
AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_students();

-- Staff table
DROP TRIGGER IF EXISTS trigger_activity_events_staff ON public.staff;
CREATE TRIGGER trigger_activity_events_staff
AFTER INSERT OR UPDATE OR DELETE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_staff();

-- Parents table
DROP TRIGGER IF EXISTS trigger_activity_events_parents ON public.parents;
CREATE TRIGGER trigger_activity_events_parents
AFTER INSERT OR UPDATE OR DELETE ON public.parents
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_parents();

-- Parents_students table
DROP TRIGGER IF EXISTS trigger_activity_events_parents_students ON public.parents_students;
CREATE TRIGGER trigger_activity_events_parents_students
AFTER INSERT OR UPDATE OR DELETE ON public.parents_students
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_parents_students();

-- Messages table
DROP TRIGGER IF EXISTS trigger_activity_events_messages ON public.messages;
CREATE TRIGGER trigger_activity_events_messages
AFTER INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_messages();

-- Conversation_reads table
DROP TRIGGER IF EXISTS trigger_activity_events_conversation_reads ON public.conversation_reads;
CREATE TRIGGER trigger_activity_events_conversation_reads
AFTER INSERT OR UPDATE OR DELETE ON public.conversation_reads
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_conversation_reads();

-- Invoices table
DROP TRIGGER IF EXISTS trigger_activity_events_invoices ON public.invoices;
CREATE TRIGGER trigger_activity_events_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_invoices();

-- Invoice_items table
DROP TRIGGER IF EXISTS trigger_activity_events_invoice_items ON public.invoice_items;
CREATE TRIGGER trigger_activity_events_invoice_items
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_invoice_items();

-- Notes table
DROP TRIGGER IF EXISTS trigger_activity_events_notes ON public.notes;
CREATE TRIGGER trigger_activity_events_notes
AFTER INSERT OR UPDATE OR DELETE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_notes();

-- Student_subsidies table
DROP TRIGGER IF EXISTS trigger_activity_events_student_subsidies ON public.student_subsidies;
CREATE TRIGGER trigger_activity_events_student_subsidies
AFTER INSERT OR UPDATE OR DELETE ON public.student_subsidies
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_student_subsidies();

-- Students_subjects table
DROP TRIGGER IF EXISTS trigger_activity_events_students_subjects ON public.students_subjects;
CREATE TRIGGER trigger_activity_events_students_subjects
AFTER INSERT OR UPDATE OR DELETE ON public.students_subjects
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_students_subjects();

-- Tutor_logs table
DROP TRIGGER IF EXISTS trigger_activity_events_tutor_logs ON public.tutor_logs;
CREATE TRIGGER trigger_activity_events_tutor_logs
AFTER INSERT OR UPDATE OR DELETE ON public.tutor_logs
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_tutor_logs();

-- Tutor_logs_staff_attendance table
DROP TRIGGER IF EXISTS trigger_activity_events_tutor_logs_staff_attendance ON public.tutor_logs_staff_attendance;
CREATE TRIGGER trigger_activity_events_tutor_logs_staff_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.tutor_logs_staff_attendance
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_tutor_logs_staff_attendance();

-- Tutor_logs_student_attendance table
DROP TRIGGER IF EXISTS trigger_activity_events_tutor_logs_student_attendance ON public.tutor_logs_student_attendance;
CREATE TRIGGER trigger_activity_events_tutor_logs_student_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.tutor_logs_student_attendance
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_tutor_logs_student_attendance();

-- Tutor_logs_topics table
DROP TRIGGER IF EXISTS trigger_activity_events_tutor_logs_topics ON public.tutor_logs_topics;
CREATE TRIGGER trigger_activity_events_tutor_logs_topics
AFTER INSERT OR UPDATE OR DELETE ON public.tutor_logs_topics
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_tutor_logs_topics();

-- Tutor_logs_topics_files table
DROP TRIGGER IF EXISTS trigger_activity_events_tutor_logs_topics_files ON public.tutor_logs_topics_files;
CREATE TRIGGER trigger_activity_events_tutor_logs_topics_files
AFTER INSERT OR UPDATE OR DELETE ON public.tutor_logs_topics_files
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_tutor_logs_topics_files();

-- Tutor_logs_topics_files_students table
DROP TRIGGER IF EXISTS trigger_activity_events_tutor_logs_topics_files_students ON public.tutor_logs_topics_files_students;
CREATE TRIGGER trigger_activity_events_tutor_logs_topics_files_students
AFTER INSERT OR UPDATE OR DELETE ON public.tutor_logs_topics_files_students
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_tutor_logs_topics_files_students();

-- Tutor_logs_topics_students table
DROP TRIGGER IF EXISTS trigger_activity_events_tutor_logs_topics_students ON public.tutor_logs_topics_students;
CREATE TRIGGER trigger_activity_events_tutor_logs_topics_students
AFTER INSERT OR UPDATE OR DELETE ON public.tutor_logs_topics_students
FOR EACH ROW EXECUTE FUNCTION public.extract_activity_fks_tutor_logs_topics_students();

-- ========================
-- ENABLE RLS
-- ========================

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- ========================
-- CREATE RLS POLICIES
-- ========================

-- ADMINSTAFF: Full access (read/write)
-- Note: Wrapped in SELECT for performance (see: 20251114000003_fix_rls_performance_cache_adminstaff_check.sql)
DROP POLICY IF EXISTS "ADMINSTAFF full access to activity_events" ON public.activity_events;
CREATE POLICY "ADMINSTAFF full access to activity_events" ON public.activity_events
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- TUTOR and STUDENT: No direct access (will be handled via views later)
-- (No policies needed - default deny)

-- ========================
-- COMMENTS
-- ========================

COMMENT ON TABLE public.activity_events IS 'Centralized activity events table capturing all changes from core entity tables for activity feeds, audit trails, and automation triggers';
COMMENT ON COLUMN public.activity_events.entity_type IS 'Table name where the change occurred (e.g., "tasks", "students", "classes")';
COMMENT ON COLUMN public.activity_events.entity_id IS 'ID of the entity that changed';
COMMENT ON COLUMN public.activity_events.event_type IS 'Type of event: CREATED, UPDATED, DELETED, FIELD_CHANGED';
COMMENT ON COLUMN public.activity_events.changed_fields IS 'For UPDATE events: JSONB object with field names as keys and {old, new} values';
COMMENT ON COLUMN public.activity_events.metadata IS 'Additional context about the change';
COMMENT ON COLUMN public.activity_events.performed_by IS 'Staff member who performed the action (from auth context)';
COMMENT ON COLUMN public.activity_events.performed_at IS 'When the action was performed';

