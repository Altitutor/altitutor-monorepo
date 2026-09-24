-- 20260721082329 revoked EXECUTE on every public SECURITY DEFINER function, then
-- re-granted only an allowlist that omitted enqueue_imessage_command (added 4 days
-- earlier). Admin-web imessage-control (react/edit/unsend/read) therefore 403s.
-- The RPC still requires active ADMINSTAFF internally.

GRANT EXECUTE ON FUNCTION public.enqueue_imessage_command(text, uuid, uuid, jsonb, text, text)
  TO authenticated;
