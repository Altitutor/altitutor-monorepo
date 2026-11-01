-- Snapshot per-person opt-outs on the log itself so attendance edits cannot
-- re-enable a text before a queued session.logged automation runs.
ALTER TABLE public.tutor_logs
  ADD COLUMN automated_text_suppressed_student_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN automated_text_suppressed_parent_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.tutor_logs.automated_text_suppressed_student_ids IS
  'Students excluded from automated texts triggered by this Tutor log; independent of global contact preferences.';
COMMENT ON COLUMN public.tutor_logs.automated_text_suppressed_parent_ids IS
  'Parents excluded from automated texts triggered by this Tutor log; independent of Student opt-outs.';

-- Keep the RPC signature, permissions, attribution and lifecycle guards intact.
-- Existing clients omit sendAutomatedText and retain the default enabled behavior.
DO $migration$
DECLARE
  original TEXT;
  updated TEXT;
BEGIN
  SELECT pg_get_functiondef('public.create_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure)
  INTO original;
  updated := replace(original,
    E'    logged_for_staff_id\n  ) VALUES (',
    E'    logged_for_staff_id,\n    automated_text_suppressed_student_ids,\n    automated_text_suppressed_parent_ids\n  ) VALUES ('
  );
  updated := replace(updated,
    E'    p_logged_for_staff_id\n  )',
    $values$    p_logged_for_staff_id,
    ARRAY(
      SELECT DISTINCT (item->>'studentId')::UUID
      FROM jsonb_array_elements(v_student_attendance_jsonb) item
      WHERE item->>'sendAutomatedText' = 'false'
    ),
    ARRAY(
      SELECT DISTINCT (item->>'parentId')::UUID
      FROM jsonb_array_elements(v_parent_attendance_jsonb) item
      WHERE item->>'sendAutomatedText' = 'false'
    )
  )$values$
  );
  IF updated = original OR updated NOT LIKE '%SELECT DISTINCT (item->>''parentId'')::UUID%' THEN
    RAISE EXCEPTION 'create_tutor_log insertion shape changed; review text-choice snapshot';
  END IF;
  EXECUTE updated;
END;
$migration$;

-- An intentional all-off choice is terminal, but is not a missing-contact alert.
ALTER TABLE public.automation_message_action_skips
  DROP CONSTRAINT automation_message_action_skips_reason_check,
  ADD CONSTRAINT automation_message_action_skips_reason_check
    CHECK (reason IN ('NO_ELIGIBLE_RECIPIENTS', 'RECIPIENTS_DISABLED_FOR_LOG'));

DO $migration$
DECLARE
  original TEXT;
  updated TEXT;
BEGIN
  SELECT pg_get_functiondef('public.record_automation_message_skip(uuid,uuid)'::regprocedure) INTO original;
  updated := replace(original,
    'p_execution_id uuid, p_action_id uuid)',
    'p_execution_id uuid, p_action_id uuid, p_reason text)');
  updated := replace(updated,
    'INSERT INTO public.automation_message_action_skips(execution_id, action_id)',
    'INSERT INTO public.automation_message_action_skips(execution_id, action_id, reason)');
  updated := replace(updated,
    'VALUES (p_execution_id, p_action_id)',
    'VALUES (p_execution_id, p_action_id, p_reason)');
  updated := replace(updated,
    'IF NOT FOUND THEN RETURN; END IF;',
    'IF NOT FOUND OR p_reason = ''RECIPIENTS_DISABLED_FOR_LOG'' THEN RETURN; END IF;');
  IF updated = original OR updated NOT LIKE '%p_reason text)%' THEN
    RAISE EXCEPTION 'Message skip RPC shape changed; review intentional skip handling';
  END IF;
  EXECUTE updated;
END;
$migration$;
-- Retain the existing two-argument API and its grants for old deployments.
CREATE OR REPLACE FUNCTION public.record_automation_message_skip(p_execution_id uuid, p_action_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM public.record_automation_message_skip(p_execution_id, p_action_id, 'NO_ELIGIBLE_RECIPIENTS');
END;
$$;
REVOKE ALL ON FUNCTION public.record_automation_message_skip(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_automation_message_skip(uuid, uuid, text) TO service_role;
