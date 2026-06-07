import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";

/**
 * Void pending practice-day discount invoice items and mark credits forfeited
 * when a UCAT subscription ends.
 */
export async function forfeitPracticeDayCreditsForStudent(
  supabase: SupabaseClient<Database>,
  stripe: Stripe,
  studentId: string,
): Promise<void> {
  const { data: credits, error } = await supabase
    .from("student_ucat_practice_day_credits")
    .select("id, stripe_invoice_item_id")
    .eq("student_id", studentId)
    .is("forfeited_at", null);

  if (error || !credits?.length) return;

  const forfeitedAt = new Date().toISOString();

  for (const credit of credits) {
    try {
      await stripe.invoiceItems.del(credit.stripe_invoice_item_id);
    } catch {
      // Item may already be invoiced or deleted — still mark forfeited locally.
    }

    await supabase
      .from("student_ucat_practice_day_credits")
      .update({ forfeited_at: forfeitedAt })
      .eq("id", credit.id);
  }
}
