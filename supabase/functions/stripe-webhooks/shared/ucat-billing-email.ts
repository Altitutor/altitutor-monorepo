import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendUcatBillingAccessEndedEmail(
  supabase: SupabaseClient,
  input: {
    studentId: string;
    planTier: string | null;
    stripeSubscriptionId: string;
  },
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!resendApiKey) {
    console.warn("[ucat-billing-email] Missing RESEND_API_KEY");
    return false;
  }

  const { data: student, error } = await supabase
    .from("students")
    .select("first_name, email")
    .eq("id", input.studentId)
    .maybeSingle();

  if (error || !student?.email) return false;

  const firstName = escapeHtml(student.first_name?.trim() || "there");
  const planName = input.planTier === "pro" ? "UCAT Pro" : "UCAT Unlimited";
  const manageUrl = `${Deno.env.get("UCAT_WEB_URL")?.replace(/\/$/, "") ?? "https://ucat.altitutor.com"}/settings/plan/subscription`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `ucat-billing-ended/${input.stripeSubscriptionId}`,
    },
    body: JSON.stringify({
      from: "Altitutor <noreply@altitutor.com>",
      to: student.email,
      subject: `Your ${planName} subscription has ended`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1f2937;line-height:1.6">
          <h1 style="color:#0a2941">Your paid UCAT plan has ended</h1>
          <p>Hi ${firstName},</p>
          <p>We couldn’t recover your subscription payment after several attempts, so your ${planName} subscription has ended.</p>
          <p>Your Altitutor account, practice history and results are safe. You can continue on the Free plan or restart your paid plan whenever you’re ready.</p>
          <p><a href="${manageUrl}" style="display:inline-block;background:#0a2941;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Review your plan</a></p>
          <p style="color:#6b7280;font-size:13px">If you believe this happened in error, reply to this email or contact Altitutor support.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend returned ${response.status}: ${await response.text()}`,
    );
  }
  return true;
}
