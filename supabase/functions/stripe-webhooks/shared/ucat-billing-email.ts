import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { deliverEdgeEmail } from "../../_shared/email.generated.ts";
import {
  buildUcatEmailActionUrl,
  escapeEmailHtml,
  renderUcatEmailButton,
  renderUcatEmailPanel,
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
  const { data: suppression } = await supabase
    .from("ucat_email_suppressions")
    .select("reason")
    .eq("email", student.email.trim().toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (suppression) {
    console.warn(
      `[ucat-billing-email] Suppressed recipient (${suppression.reason})`,
    );
    return true;
  }

  const firstName = escapeEmailHtml(student.first_name?.trim() || "there");
  const manageUrl = buildUcatEmailActionUrl({
    path: "/settings/plan/subscription",
    campaign: "ucat_billing_access_ended",
    content: "review_plan",
  });
  const html = renderUcatTransactionalEmail({
    previewText:
      "Your practice history is safe, and you can keep preparing on Free.",
    heading: "Your Unlimited access has ended",
    bodyHtml: `
      <p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">Hi ${firstName},</p>
      <p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">We could not recover your subscription payment after several attempts, so your Altitutor UCAT Unlimited subscription has ended.</p>
      ${
      renderUcatEmailPanel(
        `<strong class="email-strong" style="color:#1a1a1a">Your account, practice history and results are safe.</strong> You can keep preparing on Free or restart Unlimited whenever you are ready.`,
      )
    }
      ${renderUcatEmailButton(manageUrl, "Review your plan")}
      <p style="margin:0;color:#68757e;font-size:13px;line-height:1.6">If you think this happened in error, reply and the Altitutor team will help.</p>
    `,
  });

  await deliverEdgeEmail({
    apiKey: resendApiKey,
    to: student.email,
    idempotencyKey: `ucat-billing-ended/${input.stripeSubscriptionId}`,
    email: {
      from: UCAT_TRANSACTIONAL_FROM,
      replyTo: UCAT_TRANSACTIONAL_REPLY_TO,
      subject: "Your Altitutor UCAT Unlimited subscription has ended",
      previewText: "Your UCAT Unlimited subscription has ended.",
      html,
      text: `Hi ${
        student.first_name?.trim() || "there"
      },\n\nWe could not recover your subscription payment after several attempts, so your Altitutor UCAT Unlimited subscription has ended.\n\nYour account, practice history and results are safe. You can keep preparing on Free or restart Unlimited whenever you are ready.\n\nReview your plan: ${manageUrl}\n\nIf you think this happened in error, reply or contact ${UCAT_TRANSACTIONAL_REPLY_TO}.\n\nA not-for-profit initiative by Altitutor.`,
    },
    tags: [
      { name: "product", value: "ucat" },
      { name: "category", value: "transactional" },
      { name: "template", value: "billing_access_ended" },
    ],
  });
  return true;
}
