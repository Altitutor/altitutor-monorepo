CREATE TABLE public.ucat_signup_email_lookup_limits (
  client_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ucat_signup_email_lookup_limits_updated_at_idx
  ON public.ucat_signup_email_lookup_limits (updated_at);

COMMENT ON TABLE public.ucat_signup_email_lookup_limits IS
  'Server-only rolling-window counters for UCAT signup account discovery.';

ALTER TABLE public.ucat_signup_email_lookup_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ucat_signup_email_lookup_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ucat_signup_email_lookup_limits TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_ucat_signup_email_state(
  p_email TEXT,
  p_client_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_email TEXT := lower(trim(p_email));
  current_attempt_count INTEGER;
  account_confirmed_at TIMESTAMPTZ;
BEGIN
  IF normalized_email = '' OR p_client_key IS NULL OR trim(p_client_key) = '' THEN
    RAISE EXCEPTION 'invalid_signup_email_lookup';
  END IF;

  INSERT INTO public.ucat_signup_email_lookup_limits AS lookup_limit (
    client_key,
    window_started_at,
    attempt_count,
    updated_at
  )
  VALUES (p_client_key, now(), 1, now())
  ON CONFLICT (client_key) DO UPDATE
  SET
    window_started_at = CASE
      WHEN lookup_limit.window_started_at <= now() - interval '1 minute'
        THEN now()
      ELSE lookup_limit.window_started_at
    END,
    attempt_count = CASE
      WHEN lookup_limit.window_started_at <= now() - interval '1 minute'
        THEN 1
      ELSE lookup_limit.attempt_count + 1
    END,
    updated_at = now()
  RETURNING attempt_count INTO current_attempt_count;

  IF current_attempt_count > 10 THEN
    RAISE EXCEPTION 'signup_email_lookup_rate_limited';
  END IF;

  -- Keep the unauthenticated limiter bounded without requiring a scheduled job.
  -- Roughly one request in 100 removes counters that can no longer be useful.
  IF random() < 0.01 THEN
    DELETE FROM public.ucat_signup_email_lookup_limits
    WHERE updated_at < now() - interval '1 day';
  END IF;

  SELECT user_record.email_confirmed_at
  INTO account_confirmed_at
  FROM auth.users AS user_record
  WHERE user_record.email = normalized_email
  LIMIT 1;

  IF NOT FOUND OR account_confirmed_at IS NULL THEN
    RETURN 'available';
  END IF;

  RETURN 'confirmed';
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_ucat_signup_email_state(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ucat_signup_email_state(TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.current_ucat_signup_staff_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT staff_record.role::TEXT
  FROM public.staff AS staff_record
  WHERE staff_record.user_id = (SELECT auth.uid())
    AND staff_record.role IN ('ADMINSTAFF', 'TUTOR')
    AND staff_record.status IN ('ACTIVE', 'TRIAL')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_ucat_signup_staff_role()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_ucat_signup_staff_role()
  TO authenticated;
