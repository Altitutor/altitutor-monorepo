-- Migration: Billing runner lock and cron window
-- Description:
--   - Add a short-lived database lease so overlapping billing-runner invocations
--     exit early instead of racing to invoice the same sessions.
--   - Replace the single daily billing-runner cron with a 10-minute cadence that
--     only calls the edge function during the 9pm-10pm Australia/Adelaide window.

-- ================================================
-- TABLE: billing_runner_locks
-- ================================================

CREATE TABLE IF NOT EXISTS public.billing_runner_locks (
  lock_name text PRIMARY KEY,
  run_id text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_runner_locks_expires_at
  ON public.billing_runner_locks(expires_at);

ALTER TABLE public.billing_runner_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF can read billing_runner_locks" ON public.billing_runner_locks;
CREATE POLICY "ADMINSTAFF can read billing_runner_locks" ON public.billing_runner_locks
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT user_id FROM public.staff WHERE role = 'ADMINSTAFF' AND status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Service role can manage billing_runner_locks" ON public.billing_runner_locks;
CREATE POLICY "Service role can manage billing_runner_locks" ON public.billing_runner_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.billing_runner_locks IS
  'Short-lived lease records used to prevent overlapping billing-runner invocations.';

-- ================================================
-- RPC: try_acquire_billing_runner_lock
-- ================================================

CREATE OR REPLACE FUNCTION public.try_acquire_billing_runner_lock(
  p_lock_name text DEFAULT 'billing-runner',
  p_run_id text DEFAULT gen_random_uuid()::text,
  p_ttl_seconds integer DEFAULT 600
)
RETURNS TABLE (
  acquired boolean,
  lock_name text,
  run_id text,
  acquired_expires_at timestamptz,
  holder_run_id text,
  holder_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_ttl_seconds integer := greatest(60, least(coalesce(p_ttl_seconds, 600), 3600));
  v_expires_at timestamptz;
  v_lock public.billing_runner_locks%ROWTYPE;
BEGIN
  v_expires_at := v_now + make_interval(secs => v_ttl_seconds);

  INSERT INTO public.billing_runner_locks AS brl (
    lock_name,
    run_id,
    acquired_at,
    expires_at,
    updated_at
  )
  VALUES (
    p_lock_name,
    p_run_id,
    v_now,
    v_expires_at,
    v_now
  )
  ON CONFLICT ON CONSTRAINT billing_runner_locks_pkey DO UPDATE
    SET run_id = EXCLUDED.run_id,
        acquired_at = EXCLUDED.acquired_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at
    WHERE brl.expires_at <= v_now
  RETURNING * INTO v_lock;

  IF v_lock.lock_name IS NOT NULL THEN
    RETURN QUERY
      SELECT true, v_lock.lock_name, v_lock.run_id, v_lock.expires_at, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT *
  INTO v_lock
  FROM public.billing_runner_locks AS brl
  WHERE brl.lock_name = p_lock_name;

  RETURN QUERY
    SELECT false, p_lock_name, p_run_id, NULL::timestamptz, v_lock.run_id, v_lock.expires_at;
END;
$$;

COMMENT ON FUNCTION public.try_acquire_billing_runner_lock(text, text, integer) IS
  'Attempts to acquire the billing-runner lease. Returns acquired=false when another live run holds it.';

REVOKE EXECUTE ON FUNCTION public.try_acquire_billing_runner_lock(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.try_acquire_billing_runner_lock(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.try_acquire_billing_runner_lock(text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_billing_runner_lock(text, text, integer) TO service_role;

-- ================================================
-- RPC: release_billing_runner_lock
-- ================================================

CREATE OR REPLACE FUNCTION public.release_billing_runner_lock(
  p_lock_name text DEFAULT 'billing-runner',
  p_run_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released boolean := false;
BEGIN
  UPDATE public.billing_runner_locks AS brl
  SET expires_at = now(),
      updated_at = now()
  WHERE brl.lock_name = p_lock_name
    AND (p_run_id IS NULL OR brl.run_id = p_run_id)
  RETURNING true INTO v_released;

  RETURN coalesce(v_released, false);
END;
$$;

COMMENT ON FUNCTION public.release_billing_runner_lock(text, text) IS
  'Releases the billing-runner lease when the edge function completes.';

REVOKE EXECUTE ON FUNCTION public.release_billing_runner_lock(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_billing_runner_lock(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_billing_runner_lock(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_billing_runner_lock(text, text) TO service_role;

-- ================================================
-- CRON: billing-runner
-- ================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-runner') THEN
        PERFORM cron.unschedule('billing-runner');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule existing billing-runner cron job: %', SQLERRM;
    END;
  END IF;
END $$;

DO $$
DECLARE
  supabase_url text;
  cron_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not available. Skipping billing-runner cron job creation.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE WARNING 'pg_net extension not available. Cron job cannot make HTTP requests.';
    RETURN;
  END IF;

  supabase_url := public.get_supabase_url();
  cron_secret := public.get_billing_cron_secret();

  IF supabase_url IS NULL OR supabase_url = '' THEN
    RAISE WARNING 'Cannot schedule billing-runner cron job: Supabase URL not configured.';
    RETURN;
  END IF;

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE WARNING 'Cannot schedule billing-runner cron job: billing cron secret not configured.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'billing-runner',
    '*/10 * * * *',
    $cron$
    SELECT net.http_post(
      url := public.get_supabase_url() || '/functions/v1/billing-runner',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || public.get_billing_cron_secret(),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('trigger', 'billing-window-cron'),
      timeout_milliseconds := 300000
    )
    WHERE (now() AT TIME ZONE 'Australia/Adelaide')::time >= TIME '21:00'
      AND (now() AT TIME ZONE 'Australia/Adelaide')::time < TIME '22:00';
    $cron$
  );

  RAISE NOTICE 'Billing runner cron scheduled for every 10 minutes during 21:00-22:00 Australia/Adelaide.';
END $$;
