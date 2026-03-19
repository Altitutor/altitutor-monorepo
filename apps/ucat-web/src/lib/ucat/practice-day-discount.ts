import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'

export type MaybeGrantPracticeDayDiscountResult = {
  earnedDiscount: boolean
  discountCents: number
}

/**
 * Checks if the student qualifies for a practice-day discount and grants it if so.
 * Call after submitting question attempts (e.g. completing a set or practice session).
 *
 * Logic:
 * - Count submitted attempts for "today" in student timezone
 * - If count >= min_questions_per_day and no credit for today:
 *   - Create Stripe InvoiceItem (pending, negative amount)
 *   - Insert student_ucat_practice_day_credits
 *   - Return earnedDiscount: true
 */
export async function maybeGrantPracticeDayDiscount(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<MaybeGrantPracticeDayDiscountResult> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return { earnedDiscount: false, discountCents: 0 }
  }

  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('id, timezone')
    .eq('id', studentId)
    .maybeSingle()

  if (studentErr || !student) {
    return { earnedDiscount: false, discountCents: 0 }
  }

  const tz = student.timezone ?? 'Australia/Adelaide'

  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  const dateStr = `${year}-${month}-${day}`

  const { data: config, error: configErr } = await supabase
    .from('ucat_subscription_config')
    .select('min_questions_per_day, discount_per_day_cents')
    .limit(1)
    .maybeSingle()

  if (configErr || !config) {
    return { earnedDiscount: false, discountCents: 0 }
  }

  const minQuestions = config.min_questions_per_day ?? 20
  const discountCents = config.discount_per_day_cents ?? 1000

  const { data: countData, error: countErr } = await supabase.rpc(
    'count_submitted_attempts_today',
    { p_student_id: studentId, p_timezone: tz }
  )

  const count =
    typeof countData === 'number'
      ? countData
      : typeof countData === 'string'
        ? parseInt(countData, 10) || 0
        : 0
  if (countErr || count < minQuestions) {
    return { earnedDiscount: false, discountCents: 0 }
  }

  const { data: existingCredit } = await supabase
    .from('student_ucat_practice_day_credits')
    .select('id')
    .eq('student_id', studentId)
    .eq('credit_date', dateStr)
    .maybeSingle()

  if (existingCredit) {
    return { earnedDiscount: false, discountCents: 0 }
  }

  const { data: sub } = await supabase
    .from('student_ucat_subscriptions')
    .select('stripe_subscription_id')
    .eq('student_id', studentId)
    .in('status', ['trialing', 'active'])
    .maybeSingle()

  if (!sub?.stripe_subscription_id) {
    return { earnedDiscount: false, discountCents: 0 }
  }

  const { data: billing } = await supabase
    .from('students_billing')
    .select('stripe_customer_id')
    .eq('student_id', studentId)
    .maybeSingle()

  const customerId = billing?.stripe_customer_id
  if (!customerId) {
    return { earnedDiscount: false, discountCents: 0 }
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' })

  let invoiceItemId: string
  try {
    const item = await stripe.invoiceItems.create({
      customer: customerId,
      subscription: sub.stripe_subscription_id,
      amount: -discountCents,
      currency: 'aud',
      description: 'Practice day discount',
    })
    invoiceItemId = item.id
  } catch {
    return { earnedDiscount: false, discountCents: 0 }
  }

  const { error: insertErr } = await supabase
    .from('student_ucat_practice_day_credits')
    .insert({
      student_id: studentId,
      credit_date: dateStr,
      stripe_invoice_item_id: invoiceItemId,
      discount_cents: discountCents,
    })

  if (insertErr) {
    return { earnedDiscount: false, discountCents: 0 }
  }

  return { earnedDiscount: true, discountCents }
}
