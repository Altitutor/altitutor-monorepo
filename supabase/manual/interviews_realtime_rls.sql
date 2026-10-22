-- Run as the realtime.messages owner through the approved deployment bootstrap
-- after the interview migrations ship. Ordinary migrations cannot alter this
-- Realtime-owned table. No client may publish interview state.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS interview_round_broadcast_select ON realtime.messages;
CREATE POLICY interview_round_broadcast_select ON realtime.messages
 FOR SELECT TO authenticated USING (
  extension='broadcast'
  AND CASE WHEN (SELECT realtime.topic()) ~ '^interview-round:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN public.interview_can_receive_round(substring((SELECT realtime.topic()) FROM 17)::uuid)
    ELSE false END
 );
