-- Keep bearer-token tombstones private while allowing trusted server routes to
-- check whether one specific public journey link has been revoked.

CREATE OR REPLACE FUNCTION public.service_is_public_link_revoked(
  p_purpose TEXT,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.public_link_revocations revocation
    WHERE revocation.purpose = p_purpose
      AND revocation.token = p_token
  );
$$;

REVOKE ALL ON TABLE public.public_link_revocations
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.service_is_public_link_revoked(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_is_public_link_revoked(TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.service_is_public_link_revoked(TEXT, TEXT) IS
  'Service-only boolean lookup for a single public journey link tombstone.';
