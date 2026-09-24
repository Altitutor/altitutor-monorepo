-- 20260721082329 revoked EXECUTE on every public SECURITY DEFINER function, then
-- re-granted only an allowlist that omitted calculate_session_price (student-web
-- still calls this RPC as JWT role authenticated). Restore the original contract
-- from 20260103200661. Do not grant to anon.

GRANT EXECUTE ON FUNCTION public.calculate_session_price(
  uuid,
  public.billing_type,
  timestamptz,
  timestamptz
) TO authenticated;
