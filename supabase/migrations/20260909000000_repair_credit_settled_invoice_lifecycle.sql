-- Repair the four session-runner invoices whose local lifecycle state was made
-- stale by out-of-order Stripe webhooks or a webhook arriving before the runner
-- inserted its invoice row. Each status and timestamp below was verified against
-- the corresponding live Stripe invoice before this migration was created.
--
-- The invoice-id, billing-source, non-deleted, status, and zero-balance guards
-- keep this data repair intentionally narrow and safe to rerun.
with verified_paid_invoices(stripe_invoice_id, stripe_paid_at) as (
  values
    ('in_1UDNE6KXqPR4BofBaqcfXS4q', 1788867011::bigint),
    ('in_1TUOEiKXqPR4BofBncK347oU', 1778146134::bigint),
    ('in_1TQ2ZLKXqPR4BofBdJJUCy5a', 1777109532::bigint),
    ('in_1T5ljmKXqPR4BofBbg03SoNB', 1772278270::bigint)
)
update public.invoices as invoice
set
  status = 'paid',
  paid_at = to_timestamp(verified.stripe_paid_at),
  updated_at = now()
from verified_paid_invoices as verified
where invoice.stripe_invoice_id = verified.stripe_invoice_id
  and invoice.billing_source = 'session_runner'
  and invoice.deleted_at is null
  and invoice.status in ('draft', 'paid')
  and invoice.amount_due_cents = 0;
