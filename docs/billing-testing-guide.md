# Billing System End-to-End Testing Guide

## Prerequisites

1. **Local Supabase instance running**
   ```bash
   supabase start
   ```

2. **Stripe test account configured**
   - Set `STRIPE_SECRET_KEY` in Supabase secrets (use test key)
   - Set `STRIPE_WEBHOOK_SECRET` in Supabase secrets (for webhook testing)

3. **Test data setup**
   - At least one student with billing account
   - At least one student without billing account (to test skipped obligations)
   - At least one session with students enrolled
   - Subject with `session_fee_cents > 0`

## Database Schema Verification

### 1. Verify Tables Created

```sql
-- Check payment_attempts table exists
SELECT COUNT(*) FROM payment_attempts;

-- Check old payments table is dropped (should error if migration 20251113000002 ran)
SELECT COUNT(*) FROM payments;
```

### 2. Verify Views Created

```sql
-- Student view
SELECT * FROM vstudent_payment_attempts LIMIT 1;

-- Admin reconciliation views
SELECT COUNT(*) FROM vadmin_missing_payment_obligations;
SELECT COUNT(*) FROM vadmin_failed_payment_attempts;
SELECT COUNT(*) FROM vadmin_stuck_payment_attempts;
```

### 3. Verify RPC Function

```sql
-- Test helper function
SELECT * FROM get_latest_payment_attempts_by_student('YOUR_STUDENT_ID');
```

## Edge Function Testing

### 1. Test Billing Runner (Test Mode)

**Purpose**: Verify payment attempts are created correctly, including skipped obligations.

```bash
# Invoke billing-runner in test mode (processes today's sessions)
curl -X POST http://localhost:54321/functions/v1/billing-runner \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"testMode": true}'
```

**Expected Results**:
- ✅ Creates `payment_attempts` records with `attempt_number: 1`
- ✅ Creates failed attempts for students without billing/PM (with `failure_code`)
- ✅ Creates pending attempts for students with billing/PM
- ✅ Extracts `failure_code` from Stripe errors

**Verification Queries**:
```sql
-- Check attempts created
SELECT 
  attempt_number,
  status,
  failure_code,
  COUNT(*) 
FROM payment_attempts 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY attempt_number, status, failure_code;

-- Check skipped obligations tracked
SELECT 
  failure_code,
  COUNT(*) 
FROM payment_attempts 
WHERE status = 'failed' 
  AND failure_code IN ('no_billing_account', 'no_payment_method')
GROUP BY failure_code;
```

### 2. Test Billing Retry

**Purpose**: Verify retry creates new attempts with incremented `attempt_number`.

**Setup**: Create a failed payment attempt first:
```sql
-- Manually create a failed attempt for testing
INSERT INTO payment_attempts (
  sessions_students_id, student_id, session_id, attempt_number,
  amount_cents, currency, status, failure_code, failure_message
) VALUES (
  'YOUR_SESSIONS_STUDENTS_ID',
  'YOUR_STUDENT_ID',
  'YOUR_SESSION_ID',
  1,
  5000,
  'AUD',
  'failed',
  'card_declined',
  'Test failure'
);
```

**Test**:
```bash
curl -X POST http://localhost:54321/functions/v1/billing-retry \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Expected Results**:
- ✅ Creates new attempt with `attempt_number: 2`
- ✅ Verifies PI status before retrying (if PI exists)
- ✅ Extracts `failure_code` from Stripe errors

**Verification**:
```sql
-- Check retry attempts
SELECT 
  sessions_students_id,
  attempt_number,
  status,
  failure_code,
  created_at
FROM payment_attempts
WHERE sessions_students_id = 'YOUR_SESSIONS_STUDENTS_ID'
ORDER BY attempt_number;
```

### 3. Test Stripe Webhooks

**Purpose**: Verify webhooks update `payment_attempts` correctly by PI ID.

**Setup**: Create a test payment attempt with a Stripe PaymentIntent ID:
```sql
-- Create test attempt with PI ID
INSERT INTO payment_attempts (
  sessions_students_id, student_id, session_id, attempt_number,
  amount_cents, currency, status, stripe_payment_intent_id
) VALUES (
  'YOUR_SESSIONS_STUDENTS_ID',
  'YOUR_STUDENT_ID',
  'YOUR_SESSION_ID',
  1,
  5000,
  'AUD',
  'processing',
  'pi_test_1234567890'
);
```

**Test**: Use Stripe CLI to send test webhook:
```bash
# Install Stripe CLI if needed: https://stripe.com/docs/stripe-cli

# Send payment_intent.succeeded webhook
stripe trigger payment_intent.succeeded \
  --override payment_intent:id=pi_test_1234567890 \
  --override payment_intent:latest_charge=ch_test_1234567890

# Send payment_intent.payment_failed webhook
stripe trigger payment_intent.payment_failed \
  --override payment_intent:id=pi_test_1234567890 \
  --override payment_intent:last_payment_error:code=card_declined
```

**Expected Results**:
- ✅ Webhook updates correct attempt by `stripe_payment_intent_id`
- ✅ Extracts `failure_code` from failed payments
- ✅ Updates `charged_at`, `fee_cents`, `net_cents`, `receipt_url` on success

**Verification**:
```sql
-- Check webhook updates
SELECT 
  id,
  attempt_number,
  status,
  failure_code,
  charged_at,
  fee_cents,
  net_cents
FROM payment_attempts
WHERE stripe_payment_intent_id = 'pi_test_1234567890';
```

### 4. Test Billing Reconcile

**Purpose**: Verify reconciliation handles stuck payments and missed webhooks.

**Setup**: Create stuck payment attempts:
```sql
-- Create stuck pending attempt (no PI)
INSERT INTO payment_attempts (
  sessions_students_id, student_id, session_id, attempt_number,
  amount_cents, currency, status, created_at
) VALUES (
  'YOUR_SESSIONS_STUDENTS_ID',
  'YOUR_STUDENT_ID',
  'YOUR_SESSION_ID',
  1,
  5000,
  'AUD',
  'pending',
  NOW() - INTERVAL '25 hours'
);

-- Create stuck processing attempt (with PI)
INSERT INTO payment_attempts (
  sessions_students_id, student_id, session_id, attempt_number,
  amount_cents, currency, status, stripe_payment_intent_id, created_at
) VALUES (
  'YOUR_SESSIONS_STUDENTS_ID_2',
  'YOUR_STUDENT_ID',
  'YOUR_SESSION_ID_2',
  1,
  5000,
  'AUD',
  'processing',
  'pi_test_stuck_123',
  NOW() - INTERVAL '25 hours'
);
```

**Test**:
```bash
curl -X POST http://localhost:54321/functions/v1/billing-reconcile \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Expected Results**:
- ✅ Marks attempts without PI as failed (`payment_intent_not_created`)
- ✅ Checks Stripe for PI status
- ✅ Updates succeeded payments (handles missed webhooks)
- ✅ Updates failed payments with correct `failure_code`

**Verification**:
```sql
-- Check reconciled attempts
SELECT 
  id,
  status,
  failure_code,
  failure_message,
  charged_at
FROM payment_attempts
WHERE created_at < NOW() - INTERVAL '24 hours'
  AND status IN ('pending', 'processing', 'succeeded', 'failed');
```

## Frontend Testing

### 1. Admin Web - Payments Page

**URL**: `http://localhost:3000/billing/payments`

**Test Cases**:
1. ✅ View all payment attempts
2. ✅ Filter by status
3. ✅ See `attempt_number` column
4. ✅ See `failure_code` column
5. ✅ Search by session ID or payment intent ID

**Expected**: Table shows all attempts with attempt numbers and failure codes.

### 2. Admin Web - Reconciliation Dashboard

**URL**: `http://localhost:3000/billing/reconciliation`

**Test Cases**:
1. ✅ View missing payment obligations
2. ✅ View failed payment attempts (>= 3 attempts)
3. ✅ View stuck payment attempts (> 24 hours)
4. ✅ Click "Reconcile Stuck Payments" button
5. ✅ Verify reconciliation updates stuck payments

**Expected**: 
- Missing obligations show students without billing/PM
- Failed attempts show contact info for follow-up
- Stuck payments show PI IDs for reconciliation

### 3. Admin Web - Student Sessions Tab

**URL**: `http://localhost:3000/students/[STUDENT_ID]` (Sessions tab)

**Test Cases**:
1. ✅ View sessions with payment attempts
2. ✅ See attempt number badge for retries
3. ✅ See "Not Billed" for sessions without attempts

**Expected**: Shows latest attempt per session with attempt number.

### 4. Student Web - Payment History

**URL**: `http://localhost:3001/billing` (or payment history page)

**Test Cases**:
1. ✅ View own payment attempts via `vstudent_payment_attempts`
2. ✅ See session details and amounts
3. ✅ See receipt URLs for succeeded payments

**Expected**: Students see only their own attempts with session details.

## Integration Testing Scenarios

### Scenario 1: Complete Payment Flow

1. **Setup**: Student with billing account and payment method, session tomorrow
2. **Run**: `billing-runner` in test mode
3. **Verify**: 
   - Attempt created with `attempt_number: 1`, `status: pending`
   - Stripe PaymentIntent created
   - Webhook updates to `succeeded`
   - `charged_at`, `fee_cents`, `net_cents` populated

### Scenario 2: Failed Payment with Retry

1. **Setup**: Student with billing, use Stripe test card `4000000000000002` (declined)
2. **Run**: `billing-runner` in test mode
3. **Verify**: 
   - Attempt created with `status: failed`, `failure_code: card_declined`
4. **Run**: `billing-retry` (after backoff period)
5. **Verify**: 
   - New attempt with `attempt_number: 2`
   - If still fails, creates attempt 3

### Scenario 3: Skipped Obligation Tracking

1. **Setup**: Student without billing account, session tomorrow
2. **Run**: `billing-runner` in test mode
3. **Verify**: 
   - Failed attempt created with `failure_code: no_billing_account`
   - Shows up in `vadmin_missing_payment_obligations` view

### Scenario 4: Stuck Payment Reconciliation

1. **Setup**: Create stuck payment attempt (> 24 hours old, `status: processing`)
2. **Run**: `billing-reconcile`
3. **Verify**: 
   - Checks Stripe for PI status
   - Updates attempt based on Stripe status
   - Handles missed webhooks correctly

## Performance Testing

### Load Test Billing Runner

```bash
# Test with multiple sessions
# Create 100 sessions for tomorrow
# Run billing-runner and measure:
# - Execution time
# - Database query performance
# - Stripe API call rate limits
```

**Expected**: 
- Processes all sessions within reasonable time
- No duplicate attempts created
- All obligations tracked (even skipped ones)

## Production Readiness Checklist

- [ ] All migrations applied successfully
- [ ] Edge functions deployed and tested
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] Cron jobs configured:
  - [ ] `billing-runner`: Daily at 10 PM
  - [ ] `billing-retry`: Every 6 hours
  - [ ] `billing-reconcile`: Daily at 2 AM
- [ ] Admin reconciliation dashboard accessible
- [ ] Student payment history viewable
- [ ] Test mode Stripe charging removed (if applicable)
- [ ] Monitoring/alerts configured for:
  - [ ] High failure rates
  - [ ] Stuck payments
  - [ ] Missing obligations

## Troubleshooting

### Issue: Migration fails with "column updated_at does not exist"
**Solution**: Already fixed - migration uses `created_at` for `updated_at` when migrating from `payments` table.

### Issue: Webhook not updating payment attempts
**Check**:
- Webhook secret configured correctly
- Webhook endpoint URL correct
- Payment attempt has `stripe_payment_intent_id` set
- Webhook events logged in `stripe_webhook_events` table

### Issue: Retry creates duplicate charges
**Check**:
- Retry function verifies PI status before creating new attempt
- Idempotency keys used correctly
- Unique constraint on `(sessions_students_id, attempt_number)` working

### Issue: Missing obligations not showing
**Check**:
- `vadmin_missing_payment_obligations` view querying correctly
- Sessions have `planned_absence = false`
- Sessions are in the past (`start_at < NOW()`)

## Next Steps After Testing

1. **Deploy to Development Environment**
   - Push migrations: `supabase db push`
   - Deploy edge functions: `supabase functions deploy`
   - Configure cron jobs in Supabase Dashboard

2. **Monitor for 1-2 Weeks**
   - Check reconciliation dashboard daily
   - Verify no stuck payments
   - Verify all obligations tracked

3. **Deploy to Production**
   - After successful dev testing
   - Remove test mode Stripe charging
   - Configure production cron schedules



