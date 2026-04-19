-- Subscription vs session-runner invoices; generalise invoice_items for non-session lines
-- - billing_source enum: session_runner | subscription
-- - nullable student_subscription_id on invoices
-- - session_runner: at most one invoice per student per invoice_date (partial unique index)
-- - invoice_items: sessions_students_id + session_id nullable together; CHECK (both null or both set)

-- ========================
-- 1) Enum + invoices columns
-- ========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'invoice_billing_source' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.invoice_billing_source AS ENUM ('session_runner', 'subscription');
  END IF;
END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_source public.invoice_billing_source NOT NULL DEFAULT 'session_runner',
  ADD COLUMN IF NOT EXISTS student_subscription_id UUID REFERENCES public.student_subscriptions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.invoices.billing_source IS 'session_runner: in-person/class billing-runner invoices. subscription: Stripe subscription renewal invoices.';
COMMENT ON COLUMN public.invoices.student_subscription_id IS 'When billing_source = subscription, links to the student_subscriptions row.';

CREATE INDEX IF NOT EXISTS idx_invoices_billing_source ON public.invoices(billing_source);
CREATE INDEX IF NOT EXISTS idx_invoices_student_subscription_id
  ON public.invoices(student_subscription_id)
  WHERE student_subscription_id IS NOT NULL;

-- Replace global (student_id, invoice_date) unique with session_runner-only partial unique
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS uq_invoices_student_date;

-- Remote DBs may never have had uq_invoices_student_date, so duplicate (student_id, invoice_date)
-- rows can exist. All existing rows are session_runner (default above). Move duplicates to the
-- next calendar date free for that student (one row per loop) until no duplicates remain.
DO $$
DECLARE
  v_student_id uuid;
  v_invoice_date date;
  v_move_id uuid;
  v_keeper_id uuid;
  v_new_d date;
BEGIN
  WHILE EXISTS (
    SELECT 1
    FROM public.invoices
    GROUP BY student_id, invoice_date
    HAVING COUNT(*) > 1
  ) LOOP
    SELECT i.student_id, i.invoice_date
    INTO v_student_id, v_invoice_date
    FROM public.invoices i
    GROUP BY i.student_id, i.invoice_date
    HAVING COUNT(*) > 1
    LIMIT 1;

    SELECT id
    INTO v_keeper_id
    FROM public.invoices
    WHERE student_id = v_student_id AND invoice_date = v_invoice_date
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    SELECT id
    INTO v_move_id
    FROM public.invoices
    WHERE student_id = v_student_id
      AND invoice_date = v_invoice_date
      AND id <> v_keeper_id
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1;

    EXIT WHEN v_move_id IS NULL;

    -- Strictly after this student's latest invoice_date, so no collision with existing rows
    SELECT (COALESCE(MAX(i.invoice_date), v_invoice_date) + 1)
    INTO v_new_d
    FROM public.invoices i
    WHERE i.student_id = v_student_id;

    UPDATE public.invoices
    SET invoice_date = v_new_d, updated_at = NOW()
    WHERE id = v_move_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_session_runner_student_invoice_date
  ON public.invoices (student_id, invoice_date)
  WHERE billing_source = 'session_runner';

COMMENT ON INDEX public.uq_invoices_session_runner_student_invoice_date IS
  'At most one session-runner invoice per student per calendar invoice_date. Subscription invoices are exempt.';

-- ========================
-- 2) invoice_items: nullable session FKs + pair CHECK
-- ========================
ALTER TABLE public.invoice_items
  ALTER COLUMN sessions_students_id DROP NOT NULL,
  ALTER COLUMN session_id DROP NOT NULL;

ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_session_link_pair_chk;

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_session_link_pair_chk CHECK (
    (sessions_students_id IS NULL AND session_id IS NULL)
    OR (sessions_students_id IS NOT NULL AND session_id IS NOT NULL)
  );

COMMENT ON TABLE public.invoice_items IS
  'Line items on invoices: session-linked rows (sessions_students_id + session_id) for session_runner, or standalone rows (both null) for subscription / Stripe invoice lines.';

COMMENT ON COLUMN public.invoice_items.stripe_invoice_item_id IS
  'Stripe invoice item id (ii_*) or invoice line id (il_*) — unique across all lines.';

-- ========================
-- 3) Billing RPC: only session-runner invoices count as “invoiced sessions”
-- ========================
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
    AND i.status IN ('draft', 'open', 'paid')
    AND i.billing_source = 'session_runner';
$$;

COMMENT ON FUNCTION public.get_invoiced_sessions_students_ids(uuid[]) IS
  'Returns sessions_students_ids already invoiced via session_runner (active invoices only). Excludes subscription invoices.';

-- ========================
-- 4) Student portal views
-- ========================
DROP VIEW IF EXISTS public.vstudent_invoices;

CREATE VIEW public.vstudent_invoices
WITH (security_invoker = false)
AS
SELECT
  i.id,
  i.student_id,
  i.stripe_invoice_id,
  i.stripe_invoice_number,
  i.invoice_date,
  i.amount_due_cents,
  i.amount_paid_cents,
  i.currency,
  i.status,
  i.receipt_url,
  i.hosted_invoice_url,
  i.invoice_pdf,
  i.created_at,
  i.paid_at,
  i.finalized_at,
  i.billing_source,
  i.student_subscription_id,
  COUNT(ii.id) AS item_count,
  SUM(CASE WHEN NOT ii.is_subsidy THEN ii.amount_cents ELSE 0 END) AS total_charges_cents,
  SUM(CASE WHEN ii.is_subsidy THEN ABS(ii.amount_cents) ELSE 0 END) AS total_subsidies_cents
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
WHERE i.student_id = public.current_student_id()
GROUP BY
  i.id,
  i.student_id,
  i.stripe_invoice_id,
  i.stripe_invoice_number,
  i.invoice_date,
  i.amount_due_cents,
  i.amount_paid_cents,
  i.currency,
  i.status,
  i.receipt_url,
  i.hosted_invoice_url,
  i.invoice_pdf,
  i.created_at,
  i.paid_at,
  i.finalized_at,
  i.billing_source,
  i.student_subscription_id
ORDER BY i.invoice_date DESC, i.created_at DESC;

GRANT SELECT ON public.vstudent_invoices TO authenticated;

DROP VIEW IF EXISTS public.vstudent_invoice_items;

CREATE VIEW public.vstudent_invoice_items
WITH (security_invoker = false)
AS
SELECT
  ii.id,
  ii.invoice_id,
  ii.sessions_students_id,
  ii.amount_cents,
  ii.description,
  ii.is_subsidy,
  ii.session_id,
  ii.student_id,
  ii.created_at,
  s.start_at AS session_start_at,
  s.end_at AS session_end_at,
  s.type AS session_type,
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum
FROM public.invoice_items ii
JOIN public.invoices i ON i.id = ii.invoice_id
LEFT JOIN public.sessions s ON s.id = ii.session_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE i.student_id = public.current_student_id()
ORDER BY ii.created_at DESC;

GRANT SELECT ON public.vstudent_invoice_items TO authenticated;

COMMENT ON VIEW public.vstudent_invoices IS 'Student portal: own invoices (session_runner + subscription) with line aggregates.';
COMMENT ON VIEW public.vstudent_invoice_items IS 'Student portal: invoice lines; session fields null for subscription invoice lines.';
