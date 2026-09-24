-- Migration: Office print jobs durable connector
-- Description: print_jobs queue, connector state, enqueue/claim/complete/heartbeat RPCs, vtutor view
-- Date: 2026-08-10

CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE RESTRICT,
  bucket text NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  copies integer NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 20),
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'claimed', 'succeeded', 'failed', 'ambiguous', 'cancelled')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by text,
  completed_at timestamptz,
  cups_job_id text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result) = 'object'),
  error text,
  requested_by_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_print_jobs_claim
  ON public.print_jobs(available_at, created_at)
  WHERE status = 'queued';

CREATE INDEX idx_print_jobs_requester_file
  ON public.print_jobs(requested_by_staff_id, file_id, created_at DESC);

CREATE INDEX idx_print_jobs_status_completed
  ON public.print_jobs(status, completed_at DESC);

CREATE TABLE public.print_connector_state (
  connector_id text PRIMARY KEY CHECK (connector_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  status text NOT NULL DEFAULT 'unknown' CHECK (
    status IN ('unknown', 'healthy', 'degraded', 'offline', 'paused')
  ),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  app_version text,
  host_label text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metrics) = 'object'),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_connector_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF read print jobs"
  ON public.print_jobs FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF read print connector state"
  ON public.print_connector_state FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

-- Tutors may read connector health (for offline gate UX) without seeing other jobs.
-- Use is_tutor() (not is_staff()): development has no public.is_staff(), and
-- ADMINSTAFF already have their own SELECT policy via is_adminstaff_active().
CREATE POLICY "Tutors read print connector state"
  ON public.print_connector_state FOR SELECT TO authenticated
  USING ((SELECT public.is_tutor()));

REVOKE ALL ON public.print_jobs FROM anon, authenticated;
REVOKE ALL ON public.print_connector_state FROM anon, authenticated;
GRANT SELECT ON public.print_jobs TO authenticated;
GRANT SELECT ON public.print_connector_state TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_print_jobs
WITH (security_invoker = false)
AS
SELECT
  j.id,
  j.file_id,
  j.filename,
  j.copies,
  j.status,
  j.cups_job_id,
  j.error,
  j.created_at,
  j.updated_at,
  j.completed_at,
  j.requested_by_staff_id
FROM public.print_jobs j
WHERE j.requested_by_staff_id = public.current_staff_id()
  AND public.is_tutor();

GRANT SELECT ON public.vtutor_print_jobs TO authenticated;

CREATE OR REPLACE FUNCTION public.is_print_connector_online(
  p_stale_after interval DEFAULT interval '90 seconds'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.print_connector_state s
    WHERE s.status = 'healthy'
      AND s.last_heartbeat_at > now() - p_stale_after
  );
$$;

CREATE OR REPLACE FUNCTION public.is_office_print_window_open()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.type = 'ADMIN_SHIFT'
      AND s.status = 'ACTIVE'
      AND s.start_at <= now()
      AND s.end_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.enqueue_print_job(
  p_file_id uuid,
  p_copies integer DEFAULT 1
)
RETURNS public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id uuid;
  v_is_admin boolean;
  v_file public.files;
  v_job public.print_jobs;
  v_copies integer;
BEGIN
  v_staff_id := public.current_staff_id();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff profile required' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.is_adminstaff_active();
  IF NOT v_is_admin AND NOT public.is_tutor() THEN
    RAISE EXCEPTION 'Active staff required' USING ERRCODE = '42501';
  END IF;

  v_copies := COALESCE(p_copies, 1);
  IF v_copies < 1 OR v_copies > 20 THEN
    RAISE EXCEPTION 'copies must be between 1 and 20';
  END IF;

  IF NOT public.is_print_connector_online() THEN
    RAISE EXCEPTION 'Office printer offline' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_admin AND NOT public.is_office_print_window_open() THEN
    RAISE EXCEPTION 'Office print is only available during an admin shift'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT f.* INTO v_file
  FROM public.files f
  WHERE f.id = p_file_id
    AND f.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'File not found' USING ERRCODE = 'P0002';
  END IF;

  IF NULLIF(btrim(COALESCE(v_file.external_url, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'External URL files cannot be office-printed';
  END IF;

  IF NULLIF(btrim(COALESCE(v_file.storage_path, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(v_file.bucket, '')), '') IS NULL THEN
    RAISE EXCEPTION 'File has no storage path';
  END IF;

  IF NOT (
    v_file.mimetype = 'application/pdf'
    OR lower(v_file.filename) LIKE '%.pdf'
  ) THEN
    RAISE EXCEPTION 'Only PDF files can be office-printed';
  END IF;

  IF v_is_admin THEN
    NULL; -- admins may print any storage PDF they can open in admin-web
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.vtutor_topics_files tf
      WHERE tf.file_id = p_file_id
    ) THEN
      RAISE EXCEPTION 'File is not available to print' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.print_jobs j
    WHERE j.file_id = p_file_id
      AND j.requested_by_staff_id = v_staff_id
      AND (
        j.status IN ('queued', 'claimed')
        OR (
          j.status = 'succeeded'
          AND j.completed_at IS NOT NULL
          AND j.completed_at > now() - interval '60 seconds'
        )
      )
  ) THEN
    RAISE EXCEPTION 'A print job for this file is already in progress'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.print_jobs (
    file_id,
    bucket,
    storage_path,
    filename,
    copies,
    requested_by_staff_id
  ) VALUES (
    v_file.id,
    v_file.bucket,
    v_file.storage_path,
    v_file.filename,
    v_copies,
    v_staff_id
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_print_jobs(
  p_connector_id text,
  p_limit integer DEFAULT 5
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_connector_id !~ '^[A-Za-z0-9._-]{1,100}$' THEN
    RAISE EXCEPTION 'Invalid connectorId';
  END IF;

  -- Stale claims become ambiguous (may have already hit CUPS)
  UPDATE public.print_jobs j
  SET
    status = 'ambiguous',
    completed_at = now(),
    error = 'Connector claim lease expired; CUPS acceptance is unknown',
    updated_at = now()
  WHERE j.status = 'claimed'
    AND j.claimed_at < now() - interval '5 minutes';

  RETURN QUERY
  WITH claimed AS (
    SELECT j.id
    FROM public.print_jobs j
    WHERE j.status = 'queued'
      AND j.available_at <= now()
      AND j.attempts < j.max_attempts
    ORDER BY j.available_at, j.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20)
  ), updated AS (
    UPDATE public.print_jobs j
    SET
      status = 'claimed',
      claimed_at = now(),
      claimed_by = p_connector_id,
      attempts = j.attempts + 1,
      updated_at = now()
    FROM claimed
    WHERE j.id = claimed.id
    RETURNING j.*
  )
  SELECT jsonb_build_object(
    'id', u.id,
    'fileId', u.file_id,
    'bucket', u.bucket,
    'storagePath', u.storage_path,
    'filename', u.filename,
    'copies', u.copies,
    'attempts', u.attempts
  )
  FROM updated u;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_print_job(
  p_job_id uuid,
  p_connector_id text,
  p_status text,
  p_result jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
)
RETURNS public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.print_jobs;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('succeeded', 'failed', 'ambiguous', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid completion status';
  END IF;

  SELECT * INTO v_job
  FROM public.print_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Print job not found';
  END IF;

  IF v_job.status IN ('succeeded', 'ambiguous', 'cancelled') THEN
    RETURN v_job;
  END IF;

  IF v_job.status <> 'claimed' OR v_job.claimed_by IS DISTINCT FROM p_connector_id THEN
    RAISE EXCEPTION 'Print job is not claimed by connector';
  END IF;

  UPDATE public.print_jobs
  SET
    status = p_status,
    completed_at = now(),
    result = COALESCE(p_result, '{}'::jsonb),
    error = p_error,
    cups_job_id = COALESCE(NULLIF(p_result->>'cupsJobId', ''), cups_job_id),
    updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_print_connector(
  p_connector_id text,
  p_status text,
  p_app_version text DEFAULT NULL,
  p_host_label text DEFAULT NULL,
  p_capabilities jsonb DEFAULT '[]'::jsonb,
  p_metrics jsonb DEFAULT '{}'::jsonb,
  p_last_error_code text DEFAULT NULL
)
RETURNS public.print_connector_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state public.print_connector_state;
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_connector_id !~ '^[A-Za-z0-9._-]{1,100}$'
     OR p_status NOT IN ('healthy', 'degraded', 'offline', 'paused')
     OR jsonb_typeof(COALESCE(p_capabilities, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(COALESCE(p_metrics, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid heartbeat';
  END IF;

  INSERT INTO public.print_connector_state (
    connector_id, status, last_heartbeat_at, app_version, host_label,
    capabilities, metrics, last_error_code
  ) VALUES (
    p_connector_id, p_status, now(), left(p_app_version, 100), left(p_host_label, 100),
    COALESCE(p_capabilities, '[]'::jsonb), COALESCE(p_metrics, '{}'::jsonb),
    left(p_last_error_code, 100)
  )
  ON CONFLICT (connector_id) DO UPDATE SET
    status = EXCLUDED.status,
    last_heartbeat_at = now(),
    app_version = EXCLUDED.app_version,
    host_label = EXCLUDED.host_label,
    capabilities = EXCLUDED.capabilities,
    metrics = EXCLUDED.metrics,
    last_error_code = EXCLUDED.last_error_code,
    updated_at = now()
  RETURNING * INTO v_state;

  RETURN v_state;
END;
$$;

REVOKE ALL ON FUNCTION public.is_print_connector_online(interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_office_print_window_open() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_print_job(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_print_jobs(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_print_job(uuid, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.heartbeat_print_connector(text, text, text, text, jsonb, jsonb, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_print_connector_online(interval) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_office_print_window_open() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_print_jobs(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_print_job(uuid, text, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_print_connector(text, text, text, text, jsonb, jsonb, text) TO service_role;

COMMENT ON TABLE public.print_jobs IS
  'Durable office-print queue. Supabase is canonical; print-bridge claims work by pull.';
COMMENT ON TABLE public.print_connector_state IS
  'Sanitized print-bridge heartbeat/status; never stores connector secrets.';
COMMENT ON FUNCTION public.enqueue_print_job(uuid, integer) IS
  'Authenticated enqueue for office print. Tutors require office print window + topic file access; admins bypass window.';
