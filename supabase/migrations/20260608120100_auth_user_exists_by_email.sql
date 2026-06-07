-- Read-only check for auth.users by email (used by UCAT signup email-exists API).
CREATE OR REPLACE FUNCTION public.auth_user_exists_by_email(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.auth_user_exists_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_exists_by_email(text) TO service_role;
