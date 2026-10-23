-- DEV-8 private Broadcast authorization ships with normal CI/CD migrations.
-- Supabase delegates policy DDL on realtime.messages to postgres via supautils.
-- RLS is already enabled; ALTER TABLE would fail the table-ownership check.
-- https://supabase.com/docs/guides/realtime/authorization
DROP POLICY IF EXISTS interview_round_broadcast_select ON realtime.messages;
CREATE POLICY interview_round_broadcast_select ON realtime.messages
 FOR SELECT TO authenticated USING (
  extension = 'broadcast'
  AND topic = (SELECT realtime.topic())
  AND CASE
   WHEN (SELECT realtime.topic()) ~ '^interview-round:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   THEN public.interview_can_receive_round(substring((SELECT realtime.topic()) FROM 17)::uuid)
   ELSE false
  END
 );
-- Realtime's authorization probe supplies topic/extension and leaves the row's
-- private flag at its default false. Do not require private=true here: privacy
-- belongs to the server publication and client channel configuration, not this
-- synthetic authorization row. No INSERT policy permits client publication.
-- https://github.com/supabase/realtime/blob/main/lib/realtime/tenants/authorization.ex
