import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Record a delivery warning without changing the successful financial outcome. */
export async function warnInvoiceMissingRecipients(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<void> {
  try {
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("role", "ADMINSTAFF")
      .eq("status", "ACTIVE");
    if (staffError || !staff?.length) {
      throw new Error("Staff recipients unavailable");
    }

    const { error } = await supabase.from("notifications").upsert(
      staff.map((recipient: { id: string }) => ({
        staff_id: recipient.id,
        app_scope: "staff_web",
        notification_type: "billing.invoice_email_missing_recipients",
        title: "Invoice email not sent: no recipients",
        body:
          "The invoice was issued, but no email address was available for the enabled Student or parent delivery preferences. Review contact details and arrange invoice delivery, including for paid or zero-total invoices.",
        action_url: `/invoices/${invoiceId}`,
        priority: "important",
        metadata: { invoice_id: invoiceId },
        dedupe_key:
          `billing:invoice-email-missing-recipients:${invoiceId}:${recipient.id}`,
      })),
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    if (error) throw new Error("Notification persistence failed");
  } catch {
    // Raw database errors can contain contact data. Keep the failure observable
    // without leaking it or causing callers to retry a successfully issued bill.
    console.error(
      "[billing-runner] Invoice issued but missing-recipient staff warning could not be stored",
      { invoiceId },
    );
  }
}
