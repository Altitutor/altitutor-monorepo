import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  escapeEmailHtml,
  renderUcatTransactionalEmail,
  UCAT_TRANSACTIONAL_FROM,
  UCAT_TRANSACTIONAL_REPLY_TO,
} from "./ucat-transactional-email.ts";

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

  const firstName = escapeEmailHtml(student.first_name?.trim() || "there");
  const manageUrl = `${Deno.env.get("UCAT_WEB_URL")?.replace(/\/$/, "") ?? "https://ucat.altitutor.com"}/settings/plan/subscription`;
  const html = renderUcatTransactionalEmail({
    previewText:
      "Your practice history is safe, and you can keep preparing on Free.",
    heading: "Your Unlimited access has ended",
    bodyHtml: `
      <p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">Hi ${firstName},</p>
      <p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">We could not recover your subscription payment after several attempts, so your Altitutor UCAT Unlimited subscription has ended.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;background-color:#eaf1f3;border:1px solid #d1e0e5;border-radius:12px">
        <tr><td style="padding:18px 20px;color:#0a2941;font-size:14px;line-height:1.65"><strong>Your account, practice history and results are safe.</strong> You can keep preparing on Free or restart Unlimited whenever you are ready.</td></tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:26px 0"><tr><td align="left">
        <a href="${escapeEmailHtml(manageUrl)}" style="display:inline-block;min-width:160px;padding:14px 22px;background-color:#0a2941;border-radius:9px;color:#ffffff;font-size:15px;font-weight:700;line-height:1.4;text-align:center;text-decoration:none">Review your plan</a>
      </td></tr></table>
      <p style="margin:0;color:#68757e;font-size:13px;line-height:1.6">If you think this happened in error, reply and the Altitutor team will help.</p>
    `,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `ucat-billing-ended/${input.stripeSubscriptionId}`,
    },
    body: JSON.stringify({
      from: UCAT_TRANSACTIONAL_FROM,
      reply_to: UCAT_TRANSACTIONAL_REPLY_TO,
      to: student.email,
      subject: "Your Altitutor UCAT Unlimited subscription has ended",
      html,
      text: `Hi ${student.first_name?.trim() || "there"},\n\nWe could not recover your subscription payment after several attempts, so your Altitutor UCAT Unlimited subscription has ended.\n\nYour account, practice history and results are safe. You can keep preparing on Free or restart Unlimited whenever you are ready.\n\nReview your plan: ${manageUrl}\n\nIf you think this happened in error, reply or contact ${UCAT_TRANSACTIONAL_REPLY_TO}.\n\nA not-for-profit initiative by Altitutor.`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend returned ${response.status}: ${await response.text()}`,
    );
  }
  return true;
}
