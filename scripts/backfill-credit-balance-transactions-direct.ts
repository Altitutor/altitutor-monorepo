/**
 * Backfill credit_balance_transactions from Stripe customer balance transactions
 * (direct adjustments via customers.createBalanceTransaction, NOT from credit notes)
 *
 * Credit-note-originated transactions: use scripts/backfill-credit-balance-transactions.sql
 *
 * This script:
 * - Fetches students_billing with stripe_customer_id
 * - For each customer, lists balance transactions from Stripe
 * - Inserts any not already in credit_balance_transactions
 *
 * Usage:
 *   pnpm tsx scripts/backfill-credit-balance-transactions-direct.ts
 *   Requires: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
  console.error('Missing STRIPE_SECRET_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' });
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: billings } = await supabase
    .from('students_billing')
    .select('student_id, stripe_customer_id')
    .not('stripe_customer_id', 'is', null);

  if (!billings?.length) {
    console.log('No students with stripe_customer_id found');
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const b of billings) {
    if (!b.stripe_customer_id) continue;
    try {
      const txns = await stripe.customers.listBalanceTransactions(b.stripe_customer_id, { limit: 100 });
      for (const tx of txns.data) {
        // Skip credit_note type - those are backfilled via SQL from webhook events
        if (tx.type === 'credit_note') {
          skipped++;
          continue;
        }
        const { data: existing } = await supabase
          .from('credit_balance_transactions')
          .select('id')
          .eq('stripe_credit_balance_transaction_id', tx.id)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }
        const amount = tx.amount ?? 0;
        const type = amount <= 0 ? 'credit' : 'debit';
        const amountCents = Math.abs(amount);
        const effectiveAt = new Date((tx.created ?? 0) * 1000).toISOString();
        const { error } = await supabase.from('credit_balance_transactions').insert({
          stripe_credit_balance_transaction_id: tx.id,
          stripe_customer_id: b.stripe_customer_id,
          stripe_credit_grant_id: null,
          stripe_invoice_id: null,
          invoice_id: null,
          credit_note_id: null,
          type,
          amount_cents: amountCents,
          currency: (tx.currency ?? 'aud').toLowerCase(),
          debit_type: type === 'debit' ? (tx.type ?? 'adjustment') : null,
          credit_type: type === 'credit' ? (tx.type ?? 'adjustment') : null,
          description: tx.description ?? `Balance adjustment (backfill)`,
          effective_at: effectiveAt,
          raw: {
            id: tx.id,
            amount: tx.amount,
            type: tx.type,
            description: tx.description,
            created: tx.created,
            backfill: true,
          },
        });
        if (error) {
          console.error(`Failed to insert ${tx.id}:`, error.message);
        } else {
          inserted++;
        }
      }
    } catch (e) {
      console.error(`Error for customer ${b.stripe_customer_id}:`, e);
    }
  }

  console.log(`Inserted ${inserted}, skipped ${skipped}`);
}

main().catch(console.error);
