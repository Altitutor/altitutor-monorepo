import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type Stripe from 'npm:stripe@16.6.0';

/**
 * Void pending practice-day discount invoice items when a UCAT subscription ends.
 */
export async function forfeitPracticeDayCreditsForStudent(
  supabase: SupabaseClient,
  stripe: Stripe,
  studentId: string,
): Promise<void> {
  const { data: credits, error } = await supabase
    .from('student_ucat_practice_day_credits')
    .select('id, stripe_invoice_item_id')
    .eq('student_id', studentId)
    .is('forfeited_at', null);

  if (error || !credits?.length) return;

  const forfeitedAt = new Date().toISOString();

  for (const credit of credits) {
    try {
      await stripe.invoiceItems.del(credit.stripe_invoice_item_id);
    } catch {
      // Item may already be invoiced or deleted.
    }

    await supabase
      .from('student_ucat_practice_day_credits')
      .update({ forfeited_at: forfeitedAt })
      .eq('id', credit.id);
  }
}
