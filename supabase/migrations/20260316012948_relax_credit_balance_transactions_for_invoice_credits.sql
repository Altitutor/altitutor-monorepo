-- Migration: Relax credit_balance_transactions for invoice/credit-note credits
-- Description:
--   - stripe_credit_grant_id: Make nullable. Credit notes and direct balance adjustments
--     do not use Stripe billing credit grants; only the newer billing credits API does.
--   - Enables storing customer balance transactions from:
--     * Credit notes applied to customer balance (credit_amount)
--     * Direct balance adjustments (customers.createBalanceTransaction)

ALTER TABLE public.credit_balance_transactions
  ALTER COLUMN stripe_credit_grant_id DROP NOT NULL;

COMMENT ON COLUMN public.credit_balance_transactions.stripe_credit_grant_id IS 'Stripe credit grant ID when from billing credits API; null for credit-note or manual adjustments.';
