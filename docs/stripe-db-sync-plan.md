# Stripe-DB Sync Plan

## Investigation Summary

### 1. How does our payment methods edge function work?

**Current Implementation (`supabase/functions/payment-methods/index.ts`):**

#### `create_setup_intent` action:
- **Flow**: Creates SetupIntent in Stripe → Frontend completes card → Webhook (`setup_intent.succeeded`) → DB insert
- **Pattern**: Stripe-first, webhook syncs to DB
- **Status**: ✅ Working correctly

#### `set_default` action:
- **Flow**: Updates DB directly (`is_default = true` for selected, `false` for others)
- **Stripe Update**: ❌ **NOT updating Stripe's `invoice_settings.default_payment_method`**
- **Pattern**: DB-only update
- **Issue**: **Default payment method is NOT synced to Stripe**

#### `delete` action:
- **Flow**: Detaches from Stripe (`stripe.paymentMethods.detach`) → Deletes from DB
- **Pattern**: Updates both Stripe and DB synchronously
- **Webhook**: `payment_method.detached` webhook also tries to delete (idempotent)
- **Status**: ✅ Working correctly (double-delete is safe)

---

### 2. Payment Method Webhooks - What We Know

#### Current Webhook Handlers:
- ✅ `setup_intent.succeeded` - Adds payment method to DB
- ✅ `payment_method.detached` - Removes payment method from DB
- ❌ `payment_method.updated` - **NOT HANDLED**

#### `payment_method.updated` Webhook:
- **When triggered**: 
  - When payment method metadata changes
  - When card expiry date updates automatically (Stripe updates this periodically)
  - **NOT triggered when default payment method changes** (that's `customer.updated`)
- **What it contains**: Updated payment method object with current card details
- **Can cards be edited?**: **NO** - Cards cannot be manually edited in Stripe. Only expiry dates update automatically when Stripe receives updated information from card networks.

#### Default Payment Method Sync:
- **Current State**: ❌ **NOT SYNCED**
- **Stripe stores default in**: `customer.invoice_settings.default_payment_method`
- **We store default in**: `student_payment_methods.is_default`
- **Problem**: When we set default in DB, Stripe doesn't know. When Stripe sets default, we don't know.

---

### 3. Customer Name/Email Sync

#### Current State:
- ❌ **NO SYNC AT ALL**
- Student name/email changes in DB → Stripe customer NOT updated
- Stripe customer changes → DB NOT updated

#### Where Student Updates Happen:
1. **Admin updates**: `apps/admin-web/src/app/api/students/[id]/route.ts`
   - Updates `students` table
   - Updates `auth.users` if email/phone changed
   - **Does NOT update Stripe customer**

2. **Student self-updates**: `apps/student-web/src/app/api/profile/route.ts`
   - Updates `students` table
   - Updates `auth.users` if email/phone changed
   - **Does NOT update Stripe customer**

3. **Stripe customer updates**: 
   - Can happen via Stripe Dashboard or API
   - **No webhook handler** (`customer.updated` not handled)

---

## Recommended Sync Strategy

### Direction: **DB → Stripe** (Database is Source of Truth)

**Rationale:**
- Our database is the authoritative source for student information
- Students/parents update their info through our UI, not Stripe
- We want to ensure Stripe always reflects our current data
- Simpler to implement (one direction)

---

## Implementation Plan

### Phase 1: Fix Default Payment Method Sync

#### 1.1 Update `set_default` action in `payment-methods` edge function
**File**: `supabase/functions/payment-methods/index.ts`

**Changes needed:**
```typescript
// After setting default in DB, also update Stripe
if (action === 'set_default') {
  // ... existing DB update code ...
  
  // NEW: Update Stripe's default payment method
  const { data: billing } = await supabaseService
    .from('students_billing')
    .select('stripe_customer_id')
    .eq('student_id', targetStudentId)
    .maybeSingle();
  
  if (billing?.stripe_customer_id) {
    await stripe.customers.update(billing.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethod.stripe_payment_method_id,
      },
    });
  }
}
```

#### 1.2 Add `customer.updated` webhook handler
**File**: `supabase/functions/stripe-webhooks/index.ts`

**Changes needed:**
```typescript
case 'customer.updated': {
  const customer = event.data.object as any;
  const customerId = customer.id;
  
  // Find student by stripe_customer_id
  const { data: billing } = await supabase
    .from('students_billing')
    .select('student_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  
  if (billing?.student_id) {
    const defaultPmId = customer.invoice_settings?.default_payment_method as string | undefined;
    
    if (defaultPmId) {
      // Update DB to match Stripe's default
      await supabase
        .from('student_payment_methods')
        .update({ is_default: false })
        .eq('student_id', billing.student_id);
      
      await supabase
        .from('student_payment_methods')
        .update({ is_default: true })
        .eq('student_id', billing.student_id)
        .eq('stripe_payment_method_id', defaultPmId);
    }
  }
  
  await supabase
    .from('stripe_webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('stripe_event_id', event.id);
  return json({ received: true });
}
```

**Result**: ✅ Bidirectional sync for default payment method

---

### Phase 2: Add Payment Method Update Sync

#### 2.1 Add `payment_method.updated` webhook handler
**File**: `supabase/functions/stripe-webhooks/index.ts`

**Changes needed:**
```typescript
case 'payment_method.updated': {
  const pm = event.data.object as any;
  const paymentMethodId = pm.id as string;
  
  if (!paymentMethodId || pm.type !== 'card') {
    await supabase
      .from('stripe_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);
    return json({ received: true });
  }
  
  // Update card details in DB (mainly expiry dates)
  const card = pm.card || {};
  const { error: updateErr } = await supabase
    .from('student_payment_methods')
    .update({
      card_brand: card.brand || null,
      card_last4: card.last4 || null,
      card_exp_month: card.exp_month || null,
      card_exp_year: card.exp_year || null,
      card_country: card.country || null,
    })
    .eq('stripe_payment_method_id', paymentMethodId);
  
  if (updateErr) {
    console.error('[webhook] Failed to update payment method:', updateErr);
  }
  
  await supabase
    .from('stripe_webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('stripe_event_id', event.id);
  return json({ received: true });
}
```

**Result**: ✅ Card expiry dates stay in sync when Stripe updates them

---

### Phase 3: Add Customer Name/Email Sync (DB → Stripe)

#### 3.1 Create helper function to sync student to Stripe customer
**File**: `apps/admin-web/src/shared/lib/stripe/sync-customer.ts` (new file)

**Function:**
```typescript
export async function syncStudentToStripeCustomer(
  studentId: string,
  stripeCustomerId: string
): Promise<void> {
  // Get student data
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('first_name, last_name, email')
    .eq('id', studentId)
    .single();
  
  if (!student) return;
  
  // Update Stripe customer
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
  await stripe.customers.update(stripeCustomerId, {
    name: `${student.first_name} ${student.last_name}`.trim(),
    email: student.email || undefined,
  });
}
```

#### 3.2 Add sync call to student update endpoints

**File**: `apps/admin-web/src/app/api/students/[id]/route.ts`
- After successful student update, if `first_name`, `last_name`, or `email` changed:
  - Get `stripe_customer_id` from `students_billing`
  - Call `syncStudentToStripeCustomer()`

**File**: `apps/student-web/src/app/api/profile/route.ts`
- Same logic as above

**File**: `supabase/functions/payment-methods/index.ts`
- In `create_setup_intent`, after creating Stripe customer, ensure name/email match student

**Result**: ✅ Student name/email changes sync to Stripe automatically

---

### Phase 4: Add Customer Name/Email Sync (Stripe → DB) - Optional

#### 4.1 Enhance `customer.updated` webhook handler
**File**: `supabase/functions/stripe-webhooks/index.ts`

**Additional logic:**
```typescript
case 'customer.updated': {
  const customer = event.data.object as any;
  // ... existing default payment method logic ...
  
  // NEW: Sync name/email back to DB if changed in Stripe
  const { data: billing } = await supabase
    .from('students_billing')
    .select('student_id')
    .eq('stripe_customer_id', customer.id)
    .maybeSingle();
  
  if (billing?.student_id && (customer.name || customer.email)) {
    // Only update if different (avoid loops)
    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name, email')
      .eq('id', billing.student_id)
      .single();
    
    if (student) {
      const updates: any = {};
      
      // Parse name if provided
      if (customer.name) {
        const nameParts = customer.name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        if (firstName !== student.first_name || lastName !== student.last_name) {
          updates.first_name = firstName;
          updates.last_name = lastName;
        }
      }
      
      // Update email if provided and different
      if (customer.email && customer.email !== student.email) {
        updates.email = customer.email;
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('students')
          .update(updates)
          .eq('id', billing.student_id);
      }
    }
  }
  
  // ... rest of handler ...
}
```

**Note**: This is optional and may cause conflicts if both systems are being edited. Consider making this read-only or adding a flag to prevent loops.

**Result**: ✅ Stripe → DB sync (optional, lower priority)

---

## Summary of Changes Needed

### Critical (Must Fix):
1. ✅ **Fix `set_default` action** - Update Stripe when setting default in DB
2. ✅ **Add `customer.updated` webhook** - Sync default payment method from Stripe → DB

### Important (Should Fix):
3. ✅ **Add `payment_method.updated` webhook** - Keep card expiry dates in sync
4. ✅ **Add DB → Stripe sync for name/email** - When student info changes, update Stripe

### Optional (Nice to Have):
5. ⚠️ **Add Stripe → DB sync for name/email** - If customer updated in Stripe Dashboard

---

## Testing Checklist

### Default Payment Method:
- [ ] Set default in UI → Verify Stripe customer has correct `invoice_settings.default_payment_method`
- [ ] Change default in Stripe Dashboard → Verify DB `is_default` updates correctly
- [ ] Set default when only one payment method → Verify both DB and Stripe updated

### Payment Method Updates:
- [ ] Wait for Stripe to auto-update expiry → Verify DB expiry updates
- [ ] Verify `payment_method.updated` webhook is received and processed

### Name/Email Sync:
- [ ] Update student name in admin UI → Verify Stripe customer name updates
- [ ] Update student email in admin UI → Verify Stripe customer email updates
- [ ] Update student name in student portal → Verify Stripe customer name updates
- [ ] Create new payment method → Verify Stripe customer created with correct name/email

---

## Risk Assessment

### Low Risk:
- Adding `payment_method.updated` webhook (read-only updates)
- Adding `customer.updated` webhook for default payment method

### Medium Risk:
- DB → Stripe name/email sync (could cause issues if Stripe customer is edited externally)
- Stripe → DB name/email sync (could overwrite intentional changes)

### Mitigation:
- Add idempotency checks (only update if different)
- Add logging for all sync operations
- Consider adding a "sync_enabled" flag per customer if needed
- Test thoroughly in dev environment first

---

## Questions to Consider

1. **Should we allow Stripe → DB sync for name/email?**
   - Pro: Handles manual Stripe Dashboard edits
   - Con: Could overwrite intentional DB changes, creates potential conflicts
   - **Recommendation**: Start with DB → Stripe only, add Stripe → DB later if needed

2. **What happens if sync fails?**
   - Should we retry? How many times?
   - Should we log errors for manual review?
   - **Recommendation**: Log errors, implement retry logic with exponential backoff

3. **Should we sync on every update or batch?**
   - Current plan: Sync immediately on update
   - Alternative: Batch sync every N minutes
   - **Recommendation**: Immediate sync for better UX, but add rate limiting

4. **What about parent emails?**
   - Currently we sync to student's Stripe customer
   - If parent email matches, should we sync to all students' Stripe customers?
   - **Recommendation**: Keep current behavior (one Stripe customer per student)

