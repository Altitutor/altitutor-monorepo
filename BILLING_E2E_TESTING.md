# Billing Feature - End-to-End Testing Guide

## Prerequisites

### 1. Apply Database Migrations
```bash
cd supabase
# Push both billing migrations
supabase db push
```

### 2. Configure Environment Variables

#### For Admin-Web & Student-Web (Vercel or .env.local):
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

#### For Supabase Edge Functions (Supabase Dashboard > Edge Functions > Settings > Secrets):
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... (see webhook setup below)
```

**Note:** Fee parameters are now stored in the `billing_settings` table (no env vars needed).

### 3. Deploy Edge Functions
```bash
# Deploy all billing edge functions
supabase functions deploy card-setup
supabase functions deploy stripe-webhooks
supabase functions deploy billing-runner
supabase functions deploy billing-retry
supabase functions deploy billing-notify-fail
supabase functions deploy billing-test-charge
```

### 4. Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://<project-ref>.functions.supabase.co/stripe-webhooks`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy the signing secret (starts with `whsec_`)
5. Add to Supabase Edge Functions secrets as `STRIPE_WEBHOOK_SECRET`

### 5. Verify Billing Settings in Database

Check the `billing_settings` table has these rows (inserted by migration):
```sql
SELECT * FROM billing_settings;
```

Expected rows:
- `fee_percent_domestic`: `0.0175`
- `fee_percent_intl`: `0.029`
- `fee_fixed_cents`: `30`
- `domestic_country`: `AU`

You can update these via SQL or build an admin UI later.

---

## E2E Testing Flow

### Step 1: Set Up Test Student & Subject

1. **Create a Subject** (Admin Dashboard > Subjects):
   - Name: Test Subject
   - Billing Type: CLASS
   - Session Fee (cents): 5000 (= $50.00 AUD)
   - Currency: AUD

2. **Create a Student** (Admin Dashboard > Students):
   - First/Last Name: Test Student
   - Email: your-test-email@example.com
   - Status: ACTIVE
   - Assign the test subject to the student

3. **Create a Class** (Admin Dashboard > Classes):
   - Assign the test subject
   - Day/Time: Pick a day
   - Enroll the test student

4. **Pre-create Sessions** (Admin Dashboard > Sessions):
   - Create sessions for tomorrow and future dates
   - The student should be automatically added to `sessions_students` with `planned_absence=false`

---

### Step 2: Add Payment Method (Student-Web)

**Option A: Via Student Portal (Recommended)**
1. Log in as the student in student-web
2. Navigate to the "Add Card" section (you'll need to add this to your student UI)
3. Use this component: `apps/student-web/src/features/auth/components/AddCardSheet.tsx`
4. Enter test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. Submit - this triggers:
   - `card-setup` edge function creates a $0.50 verification PaymentIntent
   - Stripe webhook (`payment_intent.succeeded`) refunds the $0.50 and stores the payment method
   - Check `students_billing` table - should have `default_payment_method_id`, `card_brand`, `card_last4`, `card_country`, `verified_at`

**Option B: Direct Database (For Testing)**
If you don't have the student-web UI ready yet, you can manually create a test payment method:
```bash
# Use Stripe CLI
stripe customers create --email=test@example.com --name="Test Student"
# Copy the customer ID (cus_xxx)

# Create a payment method
stripe payment_methods create --type=card --card[number]=4242424242424242 --card[exp_month]=12 --card[exp_year]=2025
# Copy the payment method ID (pm_xxx)

# Attach to customer
stripe payment_methods attach pm_xxx --customer=cus_xxx

# Insert into your DB
INSERT INTO students_billing (student_id, stripe_customer_id, default_payment_method_id, card_brand, card_last4, card_country, verified_at)
VALUES ('<student-uuid>', 'cus_xxx', 'pm_xxx', 'visa', '4242', 'US', NOW());
```

---

### Step 3: Test Manual Charge (Using Test Button)

1. **Open Admin Dashboard > Students**
2. Click on your test student
3. Go to the **Sessions** tab
4. You should see upcoming sessions with a **"Test Charge"** button for sessions without payments
5. Click "Test Charge" on a session
6. This triggers the `billing-test-charge` edge function
7. Check:
   - The button should disappear and be replaced with payment status
   - Check `payments` table - should have a new row with `status='succeeded'` (or 'processing')
   - If succeeded, `stripe_charge_id`, `receipt_url`, `fee_cents`, `net_cents` should be populated via webhook
   - Check your test email for the Stripe receipt
   - Go to Stripe Dashboard > Payments - verify the charge appears

---

### Step 4: Test Scheduled Billing (Daily Runner)

**Option A: Manual Invoke (Recommended for Testing)**
```bash
# Call the billing-runner function directly
curl -X POST https://<project-ref>.functions.supabase.co/billing-runner \
  -H "Authorization: Bearer <service-role-key>"
```

Or via Supabase CLI:
```bash
supabase functions invoke billing-runner --method POST
```

This will:
- Find all sessions starting "tomorrow" (based on server time)
- Charge students who have `planned_absence=false`
- Skip students already charged for that session
- Create payment records and Stripe PaymentIntents

**Option B: Schedule via Supabase (Production)**
In Supabase Dashboard > Database > Cron Jobs (or pg_cron extension):
```sql
SELECT cron.schedule(
  'billing-runner-daily',
  '5 0 * * *', -- 00:05 every day
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.functions.supabase.co/billing-runner',
    headers := '{"Authorization": "Bearer <service-role-key>"}'::jsonb
  ) as request_id;
  $$
);
```

**Option C: Use Supabase Function Scheduler (if available in your plan)**
Dashboard > Edge Functions > billing-runner > Schedule

---

### Step 5: Test Payment Failure & Retry

1. **Trigger a Failure:**
   - In Stripe, use test card `4000 0000 0000 0341` (always fails)
   - Or simulate by removing the payment method from the customer in Stripe Dashboard
   
2. **Attempt a charge** (via test button or runner)

3. **Check Retry Logic:**
   - Payment should fail and `status='failed'` in `payments` table
   - Manually trigger retry edge function:
   ```bash
   curl -X POST https://<project-ref>.functions.supabase.co/billing-retry
   ```
   - It will retry failed payments with backoff (0h, 6h, 24h)
   - After 3 retries, `retry_count=3` and no more retries

4. **Check SMS Notification:**
   - After final retry fails, call:
   ```bash
   curl -X POST https://<project-ref>.functions.supabase.co/billing-notify-fail \
     -H "Content-Type: application/json" \
     -d '{"paymentId": "<payment-uuid>"}'
   ```
   - This should create a message and trigger SMS via your `send-sms` function
   - Check `messages` table for the SMS

---

### Step 6: Test Student Subsidy

1. **Add a Subsidy** (via SQL for now):
```sql
INSERT INTO student_subsidies (student_id, subject_id, billing_type, price_cents, currency, effective_from)
VALUES (
  '<student-uuid>',
  '<subject-uuid>',
  'CLASS',
  3000, -- $30 instead of $50
  'AUD',
  NOW()
);
```

2. **Charge the student** (test button or runner)
3. **Verify** the charged amount is $30 + fees, not $50 + fees

---

### Step 7: Test Fee Pass-Through

The billing system automatically calculates fees based on the card's country:

1. **Domestic Card (AU)**:
   - Gross = round((net + 30) / (1 - 0.0175))
   - Example: $50 net → gross = ($50.00 + $0.30) / 0.9825 ≈ $51.23

2. **International Card (non-AU)**:
   - Gross = round((net + 30) / (1 - 0.029))
   - Example: $50 net → gross = ($50.00 + $0.30) / 0.971 ≈ $51.81

3. **Test with Different Cards:**
   - Use test card `4242 4242 4242 4242` (US card)
   - Use test card `4000 0003 6000 0006` (AU card if needed)
   - Compare `amount_cents` in payments table

---

### Step 8: Admin UI Verification

1. **Payments Page** (Admin Dashboard > Payments):
   - See all payments across students
   - Filter by status, date range
   - Search by session/payment ID

2. **Student Sessions Tab** (ViewStudentModal > Sessions):
   - See all sessions for this student
   - Planned attendance
   - Payment status per session
   - Receipt links
   - Test Charge / Retry buttons

3. **Student Billing Tab** (ViewStudentModal > Billing):
   - View saved payment method (brand, last4, country)
   - Remove payment method (clears default, doesn't detach from Stripe)

---

## Troubleshooting

### Payment Not Created
- Check `students_billing` - does student have a payment method?
- Check `sessions_students` - is `planned_absence=false`?
- Check `subjects` - is `session_fee_cents > 0`?

### Webhook Not Working
- Verify webhook secret in Supabase secrets
- Check Stripe Dashboard > Webhooks > Recent events for errors
- Check Supabase Edge Functions logs

### Fee Calculation Wrong
- Check `billing_settings` table values
- Verify `card_country` in `students_billing`

### SMS Not Sending
- Check `contacts` table has phone number for student
- Check `owned_numbers` table has at least one number
- Verify Twilio credentials in Supabase secrets

---

## Production Checklist

- [ ] Replace all test Stripe keys with live keys
- [ ] Update webhook endpoint to live mode
- [ ] Schedule `billing-runner` to run daily at 00:05
- [ ] Schedule `billing-retry` to run hourly
- [ ] Monitor failed payments in admin dashboard
- [ ] Set up alerts for payment failures (Slack/email)
- [ ] Test end-to-end with a real card in live mode
- [ ] Verify receipts are being sent to correct emails
- [ ] Ensure GST/tax compliance in your jurisdiction
- [ ] Add UI for admin to manage `billing_settings` table
- [ ] Remove "Test Charge" button from production UI

---

## Next Steps / Future Enhancements

1. **Admin Billing Settings UI**: Allow editing fee percentages via admin dashboard
2. **Refund Flow**: Add UI for admins to issue refunds
3. **Invoice Itemization**: Switch to Stripe Invoices for line-item breakdowns
4. **Payment History Export**: CSV/PDF export for accounting
5. **Student Payment History**: Allow students to view their payment history in student-web
6. **Auto-retry on card update**: If payment fails, allow student to update card and auto-retry
7. **Dunning emails**: Send reminder emails before final retry


