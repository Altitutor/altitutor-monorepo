# Quick Test Guide - Billing Feature

## ✅ Fixed Issues

1. **Authorization Error** - Test Charge button now includes authentication headers
2. **Missing AddCardSheet** - Created full Stripe Elements integration for student-web
3. **Stripe Dependencies** - Installed `@stripe/stripe-js` and `@stripe/react-stripe-js` for both apps

---

## 🚀 Quick Test Steps

### 1. Deploy Edge Functions

```bash
cd /Users/matthewchua/Documents/Github/altitutor-monorepo/supabase

# Deploy all billing functions
supabase functions deploy billing-test-charge
supabase functions deploy card-setup
supabase functions deploy stripe-webhooks
supabase functions deploy billing-runner
supabase functions deploy billing-retry
supabase functions deploy billing-notify-fail
```

### 2. Set Environment Variables

**In Supabase Dashboard > Edge Functions > Settings > Secrets:**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**In both apps' `.env.local` files:**
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhooks`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy webhook secret (starts with `whsec_`) and add to Supabase secrets

### 4. Verify Database Settings

```sql
-- Check billing settings exist
SELECT * FROM billing_settings;

-- Should show:
-- fee_percent_domestic: 0.0175
-- fee_percent_intl: 0.029
-- fee_fixed_cents: 30
-- domestic_country: AU
```

---

## 🧪 Test Workflow

### A. Add Payment Method (Student Portal)

1. **Log in to student-web** at http://localhost:3001
   - Use an existing student account or create one

2. **Navigate to Dashboard**
   - You should see "Payment Method" card

3. **Click "Add Payment Method"**
   - Sheet opens with Stripe Elements form

4. **Enter test card details:**
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/26`)
   - CVC: Any 3 digits (e.g., `123`)
   - Postal: Any valid code (e.g., `12345`)

5. **Click "Add Card"**
   - Should show "Verifying..." while processing
   - $0.50 AUD charge is created and immediately refunded
   - Card details are saved to `students_billing` table
   - Sheet closes and page reloads

6. **Verify Success:**
   ```sql
   SELECT * FROM students_billing WHERE student_id = 'your-student-id';
   -- Should show: stripe_customer_id, default_payment_method_id, card_brand, card_last4, verified_at
   ```

### B. Test Manual Charge (Admin Portal)

1. **Create test data:**
   - Subject with `billing_type='CLASS'` and `session_fee_cents=5000` ($50)
   - Class assigned to that subject
   - Enroll the student (with payment method)
   - Pre-create sessions (use Sessions page)

2. **Open Admin Dashboard** at http://localhost:3000

3. **Navigate to Students > [Your Test Student] > Sessions Tab**

4. **Find an unbilled session** (shows "Not Billed" badge)

5. **Click "Test Charge" button**
   - Button changes to "Charging..."
   - Payment is processed through Stripe
   - Success toast appears
   - Table updates to show payment status

6. **Verify in Stripe Dashboard:**
   - Go to Stripe Dashboard > Payments
   - Should see the charge
   - Receipt sent to parent email (or student email)

7. **Verify in Database:**
   ```sql
   SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;
   -- Should show: status='succeeded', amount_cents, stripe_payment_intent_id, etc.
   ```

### C. Test Different Payment Scenarios

#### Test International Card
```
Card: 4000 0000 0000 0077 (Thailand card)
Expected: Higher fee (2.9% + $0.30 vs 1.75% + $0.30)
```

#### Test Failed Payment
```
Card: 4000 0000 0000 0341 (Always fails)
Expected: Payment status = 'failed', retry_count starts
```

#### Test with Subsidy
```sql
-- Add subsidy for student
INSERT INTO student_subsidies (student_id, subject_id, billing_type, price_cents, currency, effective_from)
VALUES ('student-id', 'subject-id', 'CLASS', 3000, 'AUD', NOW());

-- Test charge should now be $30 instead of $50
```

---

## 🔍 Troubleshooting

### "Missing authorization header"
- Make sure you're logged in as admin
- Check browser console for auth errors
- Clear cache and reload

### "Failed to initialize card setup"
- Check `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set correctly
- Verify card-setup function is deployed
- Check Supabase Edge Functions logs

### "Student has no payment method on file"
- Complete Step A first (Add Payment Method)
- Verify `students_billing` table has data

### Card element not loading
- Check browser console for Stripe errors
- Verify publishable key is correct (starts with `pk_test_`)
- Check network tab for failed requests

### Webhook not updating payment
- Check webhook is configured in Stripe Dashboard
- Verify webhook secret in Supabase
- Check Edge Functions logs for errors
- Test webhook using Stripe CLI: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhooks`

---

## 📊 What to Check After Testing

### Database Tables
```sql
-- Check payments
SELECT 
  p.*,
  s.start_at,
  st.first_name,
  st.last_name
FROM payments p
JOIN sessions s ON p.session_id = s.id
JOIN students st ON p.student_id = st.id
ORDER BY p.created_at DESC;

-- Check billing info
SELECT * FROM students_billing WHERE default_payment_method_id IS NOT NULL;

-- Check failed payments (for retry testing)
SELECT * FROM payments WHERE status = 'failed';
```

### Stripe Dashboard
- Payments tab: Verify charges appear
- Customers tab: Verify customer created
- Logs: Check for any errors

### Email
- Check receipt emails sent (to parent or student)
- Verify refund email for card verification

---

## 🎯 Next Steps After Testing

1. **Set up cron jobs** (see `BILLING_SETUP_STATUS.md`)
2. **Test automatic billing** by invoking billing-runner manually
3. **Test retry logic** with failed payments
4. **Monitor for a few days** before going live
5. **Switch to live Stripe keys** when ready for production

---

## ✅ Success Criteria

- [ ] Student can add card successfully
- [ ] Card verification ($0.50) is refunded automatically
- [ ] Test Charge button works for admin
- [ ] Payment appears in Stripe Dashboard
- [ ] Payment status updates in database
- [ ] Receipt email is sent
- [ ] Different card types charge correct fees
- [ ] Failed payments are handled gracefully
- [ ] Subsidies work correctly

**If all checks pass, the feature is ready for scheduled automation!** 🎉


