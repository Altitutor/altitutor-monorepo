-- Migration: Fix invoice_date to use session date in Australia/Adelaide
--
-- Invoice dates were previously set from session start_at in UTC, causing
-- mismatches when the Adelaide calendar date differs (e.g. session 23:00 UTC
-- = next day morning in Adelaide). This backfill sets invoice_date to the
-- session date in Australia/Adelaide for any invoice that has session line
-- items. Invoices with only fee items are unchanged.
--
-- Logic: For each invoice with at least one session line item, compute the
-- correct date as the minimum (earliest) session date in Adelaide; update
-- invoice_date only where it differs.

WITH session_dates AS (
  SELECT
    ii.invoice_id,
    (s.start_at AT TIME ZONE 'Australia/Adelaide')::date AS adelaide_date
  FROM public.invoice_items ii
  JOIN public.sessions s ON s.id = ii.session_id
  WHERE ii.sessions_students_id IS NOT NULL
    AND (ii.is_fee IS NULL OR ii.is_fee = false)
),
correct_dates AS (
  SELECT
    invoice_id,
    MIN(adelaide_date) AS correct_date
  FROM session_dates
  GROUP BY invoice_id
)
UPDATE public.invoices i
SET invoice_date = cd.correct_date
FROM correct_dates cd
WHERE i.id = cd.invoice_id
  AND i.invoice_date IS DISTINCT FROM cd.correct_date;
