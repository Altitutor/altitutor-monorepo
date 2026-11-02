import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Notification failure must never turn a persisted invoice into a rebilling attempt. */
export async function warnInvoiceWithoutRecipients(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  try {
    const { data: staff, error: staffError } = await supabase.from("staff")
      .select("id").eq("role", "ADMINSTAFF").eq("status", "ACTIVE");
    if (staffError) throw staffError;
    if (!staff?.length) {
      throw new Error("No active admin notification recipients");
    }
    const { error } = await supabase.from("notifications").upsert(
      staff.map((recipient: { id: string }) => ({
        staff_id: recipient.id,
        app_scope: "staff_web",
        notification_type: "INVOICE_EMAIL_NO_RECIPIENTS",
        title: "Invoice email needs attention",
        body:
          "Billing continued, but no permitted Student or parent email recipient was resolved. Check contact details and invoice-email preferences. No email will be sent automatically later.",
        action_url: `/invoices/${invoiceId}`,
        dedupe_key: `invoice:no-email-recipient:${invoiceId}:${recipient.id}`,
      })),
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    if (error) throw error;
  } catch {
    console.error(
      "[billing-runner] Could not persist missing invoice email recipient warning",
      { invoiceId },
    );
  }
}
