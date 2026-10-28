-- A contactless action outcome survives retries of the containing execution.
CREATE TABLE public.automation_message_action_skips (
  execution_id uuid NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES public.automation_actions(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'NO_ELIGIBLE_RECIPIENTS'
    CHECK (reason = 'NO_ELIGIBLE_RECIPIENTS'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (execution_id, action_id)
);
ALTER TABLE public.automation_message_action_skips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_message_action_skips FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.automation_message_action_skips TO service_role;
GRANT SELECT ON public.automation_message_action_skips TO authenticated;
CREATE POLICY "ADMINSTAFF can read terminal automation message skips"
  ON public.automation_message_action_skips FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

CREATE FUNCTION public.record_automation_message_skip(p_execution_id uuid, p_action_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  rule_name text;
  event_id uuid;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  SELECT r.name, e.domain_event_id INTO rule_name, event_id
    FROM public.automation_executions e
    JOIN public.automation_actions a ON a.rule_id = e.rule_id AND a.id = p_action_id
    JOIN public.automation_rules r ON r.id = e.rule_id
    WHERE e.id = p_execution_id AND a.action_type = 'SEND_MESSAGE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Message action does not belong to execution'; END IF;

  INSERT INTO public.automation_message_action_skips(execution_id, action_id)
    VALUES (p_execution_id, p_action_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;

  -- Persist the reason and its existing staff-inbox surface in one transaction.
  INSERT INTO public.notifications(staff_id, app_scope, notification_type, title, body,
    action_url, dedupe_key, domain_event_id)
    SELECT s.id, 'staff_web', 'AUTOMATION_MESSAGE_SKIPPED',
      'Message skipped: ' || rule_name,
      'No eligible message recipients were resolved. This action will not retry automatically; other actions continue.',
      '/settings/automation',
      'automation:message-skip:' || p_execution_id || ':' || p_action_id || ':' || s.id,
      event_id
    FROM public.staff s WHERE s.role = 'ADMINSTAFF' AND s.status = 'ACTIVE'
    ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.record_automation_message_skip(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_automation_message_skip(uuid, uuid) TO service_role;
COMMENT ON TABLE public.automation_message_action_skips IS
  'Terminal zero-recipient message outcomes. A later execution retry must not resolve or send these actions again.';
