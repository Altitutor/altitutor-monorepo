-- Issues share the existing Task/Project priority scale. Existing issues start unprioritized.
ALTER TABLE public.issues ADD COLUMN priority integer NOT NULL DEFAULT 0;
ALTER TABLE public.issues ADD CONSTRAINT issues_priority_check CHECK (priority BETWEEN 0 AND 4);
COMMENT ON COLUMN public.issues.priority IS '0 No priority, 1 Urgent, 2 High, 3 Medium, 4 Low; same scale as tasks and projects.';

-- Extend the established mutation paths without replacing their later validation,
-- history, attribution, conflict handling or edit-session guards.
DO $$
DECLARE
  target regprocedure;
  definition text;
  updated_definition text;
  old_allowlist constant text := 'when ''issue'' then array[''name'',''description'',''status'',''due_date'']';
  new_allowlist constant text := 'when ''issue'' then array[''name'',''description'',''status'',''due_date'',''priority'']';
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'admin_operations.admin_work_item_change(text,uuid,bigint,text,jsonb)'::regprocedure,
    'public.admin_work_item_patch(text,uuid,jsonb,jsonb,text)'::regprocedure
  ] LOOP
    SELECT pg_get_functiondef(target) INTO definition;
    updated_definition := replace(definition, old_allowlist, new_allowlist);
    IF definition = updated_definition OR
       (length(definition) - length(replace(definition, old_allowlist, ''))) / length(old_allowlist) <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one Issue property allowlist in %', target;
    END IF;
    EXECUTE updated_definition;
  END LOOP;
END $$;

CREATE OR REPLACE VIEW admin_reporting.issues WITH (security_barrier=true) AS
  SELECT id, name, status, description, created_by, created_at, updated_at,
    due_date, resolved_at, resolved_by, priority FROM public.issues;
