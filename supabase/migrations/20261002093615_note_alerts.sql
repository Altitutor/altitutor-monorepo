-- Alerts are persistent flags on entity notes, independent of their rich text.
ALTER TABLE public.notes ADD COLUMN is_alert boolean NOT NULL DEFAULT false;
ALTER TABLE public.notes ADD CONSTRAINT notes_alert_target_check
  CHECK (NOT is_alert OR target_type IN ('student', 'students', 'parent', 'parents', 'staff'));
CREATE INDEX notes_entity_alerts_idx ON public.notes (target_type, target_id)
  WHERE is_alert;

-- Extend the existing authenticated, revision-checked mutation path without
-- replacing its later concurrency and edit-session safeguards.
DO $$
DECLARE
  definition text;
  updated_definition text;
BEGIN
  SELECT pg_get_functiondef('admin_operations.admin_work_item_change(text,uuid,bigint,text,jsonb)'::regprocedure)
    INTO definition;
  updated_definition := replace(definition,
    'array[''note'',''target_type'',''target_id''] else array[''note'']',
    'array[''note'',''target_type'',''target_id'',''is_alert''] else array[''note'',''is_alert'']');
  IF definition = updated_definition THEN
    RAISE EXCEPTION 'Expected the note mutation property allowlist';
  END IF;
  EXECUTE updated_definition;
END $$;

CREATE OR REPLACE VIEW admin_reporting.notes WITH (security_barrier=true) AS
  SELECT id, target_type, target_id, note, created_at, updated_at, created_by, is_alert
  FROM public.notes;
COMMENT ON COLUMN public.notes.is_alert IS
  'Marks a student, parent or staff note for display as an alert in the entity header.';
