# Billing System Flow & Production Readiness

## Overview
The billing system processes session charges daily via a cron job (`billing-runner`). This document explains the complete flow and potential failure points.

## Complete Flow

### 1. **Billing Runner Execution** (`billing-runner` edge function)
   - **Trigger**: Daily cron job (or manual test mode)
   - **Process**:
     1. Finds sessions for target date (tomorrow in production, today in test)
     2. Loads students attending those sessions
     3. Checks for existing payments (prevents duplicates)
     4. Calculates fees (domestic vs international cards)
     5. Creates payment records with status `pending`
     6. Creates Stripe PaymentIntent and confirms immediately (`off_session: true`)
     7. Updates payment record with PaymentIntent ID and status

   **Potential Failure Points**:
   - ❌ Student has no billing account → Skipped (no payment created)
   - ❌ Student has no default payment method → Skipped (no payment created)
   - ❌ Stripe API failure → Payment marked as `failed`, error logged
   - ❌ Database update failure → Payment stays `pending` (webhook will fix)

### 2. **Stripe Processing**
   - Stripe processes the PaymentIntent asynchronously
   - May require 3D Secure authentication (rare for off_session)
   - Usually succeeds immediately for saved cards

   **Potential Failure Points**:
   - ❌ Card declined → Stripe sends `payment_intent.payment_failed` webhook
   - ❌ Insufficient funds → Stripe sends `payment_intent.payment_failed` webhook
   - ❌ Card expired → Stripe sends `payment_intent.payment_failed` webhook

### 3. **Webhook Processing** (`stripe-webhooks` edge function)
   - **Trigger**: Stripe sends webhook events
   - **Events Handled**:
     - `payment_intent.succeeded` → Updates payment to `succeeded`, sets `charged_at`
     - `payment_intent.payment_failed` → Updates payment to `failed`, sets failure message
     - `charge.refunded` → Updates payment to `refunded`, sets `refunded_at`

   **Potential Failure Points**:
   - ❌ Webhook not received → Payment stays `pending` (manual retry needed)
   - ❌ Webhook signature invalid → Event rejected (Stripe will retry)
   - ❌ Database update fails → Event logged, payment not updated (manual fix needed)
   - ❌ Webhook processing error → Event marked with error, payment not updated

### 4. **Payment Status Updates**
   - Payment status flows: `pending` → `processing` → `succeeded` or `failed`
   - Status is updated in two places:
     1. Immediately after PaymentIntent creation (billing-runner)
     2. When webhook is received (stripe-webhooks)

## Current Issues Fixed

### ✅ Fixed Issues
1. **Missing `updated_at` column**: Added to payments table (trigger was failing)
2. **RLS Policy**: Added student policy so students can view their own payments
3. **Field name mismatches**: Fixed `amount` → `amount_cents`, `stripe_receipt_url` → `receipt_url`

### ⚠️ Remaining Considerations

1. **Webhook Reliability**
   - Stripe retries failed webhooks automatically
   - Failed webhooks are logged in `stripe_webhook_events` table
   - Consider adding a monitoring/alerting system for failed webhooks

2. **Payment Status Stuck in Pending**
   - If webhook never arrives, payment stays `pending`
   - Consider adding a reconciliation job that checks Stripe for payment status
   - Or add manual retry mechanism in admin UI

3. **Idempotency**
   - ✅ PaymentIntent uses payment ID as idempotency key
   - ✅ Duplicate payments prevented by unique index on `sessions_students_id`
   - ✅ Webhook events checked for duplicates

4. **Error Handling**
   - ✅ Stripe errors are caught and logged
   - ✅ Database errors are caught and logged
   - ⚠️ Consider adding retry logic for transient failures

5. **Monitoring**
   - ✅ Webhook events are logged to `stripe_webhook_events` table
   - ⚠️ Consider adding alerts for:
     - High failure rate
     - Stuck pending payments
     - Webhook processing errors

## Production Readiness Checklist

- [x] Payment creation works
- [x] Stripe charging works
- [x] Webhook processing works
- [x] Payment status updates work
- [x] Student can view payment history
- [x] Duplicate prevention in place
- [x] Error logging in place
- [ ] Monitoring/alerting system
- [ ] Reconciliation job for stuck payments
- [ ] Manual retry mechanism
- [ ] Remove test mode Stripe charging before production

## Testing Recommendations

1. **Test successful payment flow**:
   - Run billing-runner in test mode
   - Verify payment created with `pending` status
   - Verify Stripe charge succeeds
   - Verify webhook updates payment to `succeeded`
   - Verify student can see payment in history

2. **Test failure scenarios**:
   - Test with declined card (use Stripe test card `4000000000000002`)
   - Verify payment marked as `failed`
   - Verify failure message recorded

3. **Test webhook reliability**:
   - Simulate webhook failure
   - Verify retry mechanism works
   - Verify payment eventually updates

4. **Test duplicate prevention**:
   - Try to create duplicate payment
   - Verify unique constraint prevents it

## Manual Recovery Procedures

### Payment Stuck in Pending
1. Check `stripe_webhook_events` table for related events
2. If webhook received but failed, check error message
3. Manually update payment status if needed
4. Or trigger webhook retry from Stripe dashboard

### Payment Status Mismatch
1. Query Stripe API for PaymentIntent status
2. Compare with database status
3. Update database to match Stripe if needed



