-- Run once in the Supabase Dashboard SQL Editor after
-- 20260721100000_imessage_connector_realtime_wake.sql has been applied via CI.
--
-- Migrations cannot ALTER/CREATE POLICY on realtime.messages (owned by Realtime).
-- This policy authorizes only the dedicated Mac connector Auth identity to receive
-- private broadcasts on imessage:connector:wake. It does not grant access to
-- imessage_commands or any command payload.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS imessage_connector_wake_broadcast_select ON realtime.messages;
CREATE POLICY imessage_connector_wake_broadcast_select
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND (SELECT realtime.topic()) = public.imessage_connector_wake_topic()
    AND COALESCE((auth.jwt()->'app_metadata'->>'imessage_connector')::boolean, false)
  );
