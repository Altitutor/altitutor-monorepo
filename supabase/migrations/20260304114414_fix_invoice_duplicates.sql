-- Migration: Fix duplicate invoice_items per sessions_students_id
-- Description:
--   - Identify sessions_students_id values that have more than one non-fee, non-subsidy
--     invoice_items row across active invoices
--   - Persist this information into a working table for auditing
--   - Remove duplicate invoice_items rows so that only the canonical invoice remains
--     per sessions_students_id
--   - Optionally mark now-empty duplicate invoices as voided
--
-- Notes:
--   - This migration is designed to be idempotent. Running it multiple times will
--     simply refresh the working table and re-apply the same deletions.
--   - Stripe-level refunding/voiding of duplicate invoices should be handled
--     separately via the dashboard or automation, using the data recorded in the
--     billing_duplicates_work table.

-- ================================================
-- WORKING TABLE
-- ================================================

create table if not exists public.billing_duplicates_work (
  sessions_students_id uuid primary key,
  canonical_invoice_id uuid not null,
  duplicate_invoice_ids uuid[] not null,
  canonical_invoice_item_ids uuid[] not null,
  duplicate_invoice_item_ids uuid[] not null,
  created_at timestamptz not null default now()
);

comment on table public.billing_duplicates_work is
  'Tracks invoice/session duplicates during billing idempotency hardening. One row per sessions_students_id with more than one non-fee invoice_items row.';

-- ================================================
-- DETECT DUPLICATES
-- ================================================

with dup_items as (
  select
    ii.sessions_students_id,
    ii.id as invoice_item_id,
    ii.invoice_id,
    row_number() over (
      partition by ii.sessions_students_id
      order by inv.invoice_date, inv.created_at, ii.created_at
    ) as rn
  from public.invoice_items ii
  join public.invoices inv
    on inv.id = ii.invoice_id
  where
    ii.is_fee = false
    and ii.is_subsidy = false
    and ii.sessions_students_id is not null
),
agg as (
  select
    sessions_students_id,
    -- Canonical invoice is the one with the first row_number()
    (array_agg(invoice_id order by rn))[1] as canonical_invoice_id,
    (array_agg(invoice_id order by rn))[2:array_length(array_agg(invoice_id), 1)] as duplicate_invoice_ids,
    (array_agg(invoice_item_id order by rn))[1:1] as canonical_invoice_item_ids,
    (array_agg(invoice_item_id order by rn))[2:array_length(array_agg(invoice_item_id), 1)] as duplicate_invoice_item_ids,
    count(*) as cnt
  from dup_items
  group by sessions_students_id
  having count(*) > 1
)
insert into public.billing_duplicates_work (
  sessions_students_id,
  canonical_invoice_id,
  duplicate_invoice_ids,
  canonical_invoice_item_ids,
  duplicate_invoice_item_ids
)
select
  a.sessions_students_id,
  a.canonical_invoice_id,
  coalesce(a.duplicate_invoice_ids, array[]::uuid[]),
  coalesce(a.canonical_invoice_item_ids, array[]::uuid[]),
  coalesce(a.duplicate_invoice_item_ids, array[]::uuid[])
from agg a
on conflict (sessions_students_id) do update
set
  canonical_invoice_id        = excluded.canonical_invoice_id,
  duplicate_invoice_ids       = excluded.duplicate_invoice_ids,
  canonical_invoice_item_ids  = excluded.canonical_invoice_item_ids,
  duplicate_invoice_item_ids  = excluded.duplicate_invoice_item_ids,
  created_at                  = now();

-- ================================================
-- DELETE DUPLICATE INVOICE ITEMS
-- ================================================

-- Remove all invoice_items (both fee and non-fee) that belong to duplicate
-- invoices for the affected sessions_students_id values.

delete from public.invoice_items ii
using public.billing_duplicates_work w
where
  ii.sessions_students_id = w.sessions_students_id
  and ii.invoice_id = any(w.duplicate_invoice_ids);

-- ================================================
-- OPTIONALLY MARK EMPTY DUPLICATE INVOICES AS VOIDED
-- ================================================

-- Any invoice that has been stripped of all invoice_items by the above deletion
-- is now effectively an empty shell. Mark these as voided for clarity while
-- preserving them for audit purposes.

update public.invoices inv
set status = 'void'
from public.billing_duplicates_work w
where
  inv.id = any(w.duplicate_invoice_ids)
  and not exists (
    select 1
    from public.invoice_items ii
    where ii.invoice_id = inv.id
  )
  and inv.status <> 'void';

