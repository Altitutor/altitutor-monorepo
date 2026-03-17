-- Migration: Billing runner RPC and error logs
-- Description:
--   - Create RPC get_invoiced_sessions_students_ids to avoid PostgREST URL length limit (Bad Request)
--     when checking which sessions_students are already invoiced (large .in() clauses)
--   - Create billing_runner_logs table for persisting per-student invoicing failures
--   - Enables investigation and retry of failed invoicing attempts

-- ================================================
-- RPC: get_invoiced_sessions_students_ids
-- ================================================
-- Uses POST body (not URL) so no length limit on array size.
-- Returns sessions_students_ids that have invoice_items in active (draft/open/paid) invoices.

CREATE OR REPLACE FUNCTION public.get_invoiced_sessions_students_ids(p_sessions_students_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ii.sessions_students_id
  FROM public.invoice_items ii
  JOIN public.invoices i ON i.id = ii.invoice_id
  WHERE ii.sessions_students_id = ANY(p_sessions_students_ids)
    AND ii.is_fee = false
    AND i.status IN ('draft', 'open', 'paid');
$$;

COMMENT ON FUNCTION public.get_invoiced_sessions_students_ids(uuid[]) IS
  'Returns sessions_students_ids that are already invoiced (active invoices only). Used by billing-runner to avoid PostgREST URL length limits.';

-- Grant execute to service_role (used by billing-runner)
GRANT EXECUTE ON FUNCTION public.get_invoiced_sessions_students_ids(uuid[]) TO service_role;

-- ================================================
-- TABLE: billing_runner_logs
-- ================================================
-- Persists per-student invoicing failures for investigation and retry.

CREATE TABLE IF NOT EXISTS public.billing_runner_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text,
  sessions_students_id uuid REFERENCES public.sessions_students(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  invoice_date date,
  error_type text,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_runner_logs_created_at ON public.billing_runner_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_billing_runner_logs_sessions_students_id ON public.billing_runner_logs(sessions_students_id);
CREATE INDEX IF NOT EXISTS idx_billing_runner_logs_student_id ON public.billing_runner_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_billing_runner_logs_run_id ON public.billing_runner_logs(run_id) WHERE run_id IS NOT NULL;

ALTER TABLE public.billing_runner_logs ENABLE ROW LEVEL SECURITY;

-- Only ADMINSTAFF can read logs
DROP POLICY IF EXISTS "ADMINSTAFF can read billing_runner_logs" ON public.billing_runner_logs;
CREATE POLICY "ADMINSTAFF can read billing_runner_logs" ON public.billing_runner_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT user_id FROM public.staff WHERE role = 'ADMINSTAFF' AND status = 'ACTIVE'
    )
  );

-- Service role can insert (billing-runner uses service role)
DROP POLICY IF EXISTS "Service role can insert billing_runner_logs" ON public.billing_runner_logs;
CREATE POLICY "Service role can insert billing_runner_logs" ON public.billing_runner_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE public.billing_runner_logs IS
  'Logs per-student invoicing failures from billing-runner for investigation and retry';
