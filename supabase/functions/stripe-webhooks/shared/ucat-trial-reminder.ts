import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  escapeEmailHtml,
  renderUcatTransactionalEmail,
  UCAT_TRANSACTIONAL_FROM,
  UCAT_TRANSACTIONAL_REPLY_TO,
} from "./ucat-transactional-email.ts";

function money(cents: number, currency = "aud"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export async function sendUcatTrialReminder(
  supabase: SupabaseClient,
  subscription: { id: string; trial_end?: number | null },
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!resendApiKey || !subscription.trial_end) {
    console.warn("[ucat-trial-reminder] Missing RESEND_API_KEY or trial_end");
    return;
  }

  const { data: stored } = await supabase
    .from("student_subscriptions")
    .select(
      "student_id, plan_tier, billing_interval, current_period_start, current_period_end",
    )
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (!stored?.student_id || !stored.plan_tier || !stored.billing_interval)
    return;

  const [
    { data: student },
    { data: price },
    { data: config },
    { data: credits },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("first_name, email")
      .eq("id", stored.student_id)
      .maybeSingle(),
    supabase
      .from("ucat_plan_prices")
      .select("base_price_cents")
      .eq("plan_tier", stored.plan_tier)
      .eq("billing_interval", stored.billing_interval)
      .maybeSingle(),
    supabase
      .from("ucat_subscription_config")
      .select("currency, min_questions_per_day")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("student_ucat_practice_day_credits")
      .select("discount_cents")
      .eq("student_id", stored.student_id)
      .is("forfeited_at", null)
      .gte(
        "credit_date",
        stored.current_period_start?.slice(0, 10) ?? "0001-01-01",
      )
      .lte(
        "credit_date",
        stored.current_period_end?.slice(0, 10) ?? "9999-12-31",
      ),
  ]);

  if (!student?.email || price?.base_price_cents == null) return;
  const earnedCents = (credits ?? []).reduce(
    (total, credit) => total + (credit.discount_cents ?? 0),
    0,
  );
  const currency = config?.currency ?? "aud";
  const estimatedCents = Math.max(0, price.base_price_cents - earnedCents);
  const trialEnd = new Date(subscription.trial_end * 1000).toLocaleDateString(
    "en-AU",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Australia/Adelaide",
    },
  );
  const manageUrl = `${Deno.env.get("UCAT_WEB_URL")?.replace(/\/$/, "") ?? "https://ucat.altitutor.com"}/settings/plan/subscription`;
  const firstName = escapeEmailHtml(student.first_name?.trim() || "there");
  const standardPrice = money(price.base_price_cents, currency);
  const earnedDiscount = money(earnedCents, currency);
  const estimatedBill = money(estimatedCents, currency);
  const dailyQuestionTarget = config?.min_questions_per_day ?? 20;
  const html = renderUcatTransactionalEmail({
    previewText: `Your Unlimited trial ends on ${trialEnd}. Review your estimated first payment.`,
    heading: "Your Unlimited trial ends soon",
    bodyHtml: `
      <p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">Hi ${firstName},</p>
      <p style="margin:0;color:#394650;font-size:15px;line-height:1.7">Your Altitutor UCAT Unlimited trial ends on <strong style="color:#0a2941">${escapeEmailHtml(trialEnd)}</strong>. Your subscription will begin after the trial unless you cancel.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;background-color:#eaf1f3;border:1px solid #d1e0e5;border-radius:12px"><tr><td style="padding:18px 20px">
        <p style="margin:0 0 10px;color:#394650;font-size:14px;line-height:1.5"><strong style="color:#0a2941">Standard price</strong><br>${escapeEmailHtml(standardPrice)}</p>
        <p style="margin:0 0 10px;color:#394650;font-size:14px;line-height:1.5"><strong style="color:#0a2941">Practice discounts earned</strong><br>${escapeEmailHtml(earnedDiscount)}</p>
        <p style="margin:0;color:#394650;font-size:14px;line-height:1.5"><strong style="color:#0a2941">Current estimated first payment</strong><br>${escapeEmailHtml(estimatedBill)}</p>
      </td></tr></table>
      <p style="margin:0 0 16px;color:#394650;font-size:14px;line-height:1.65">You can keep reducing your first payment before the trial ends by completing ${dailyQuestionTarget}+ questions on an eligible practice day.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:26px 0"><tr><td align="left">
        <a href="${escapeEmailHtml(manageUrl)}" style="display:inline-block;min-width:180px;padding:14px 22px;background-color:#0a2941;border-radius:9px;color:#ffffff;font-size:15px;font-weight:700;line-height:1.4;text-align:center;text-decoration:none">Review subscription</a>
      </td></tr></table>
      <p style="margin:0;color:#68757e;font-size:13px;line-height:1.6">Your final payment may be lower if you earn more practice-day discounts before billing. You can cancel before the trial ends from your subscription settings.</p>
    `,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: UCAT_TRANSACTIONAL_FROM,
      reply_to: UCAT_TRANSACTIONAL_REPLY_TO,
      to: student.email,
      subject: `Your Altitutor UCAT Unlimited trial ends on ${trialEnd}`,
      html,
      text: `Hi ${student.first_name?.trim() || "there"},\n\nYour Altitutor UCAT Unlimited trial ends on ${trialEnd}. Your subscription will begin after the trial unless you cancel.\n\nStandard price: ${standardPrice}\nPractice discounts earned: ${earnedDiscount}\nCurrent estimated first payment: ${estimatedBill}\n\nYou can keep reducing your first payment before the trial ends by completing ${dailyQuestionTarget}+ questions on an eligible practice day. Your final payment may be lower if you earn more practice-day discounts before billing.\n\nReview or cancel your subscription: ${manageUrl}\n\nQuestions? Reply or contact ${UCAT_TRANSACTIONAL_REPLY_TO}.\n\nA not-for-profit initiative by Altitutor.`,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Resend returned ${response.status}: ${await response.text()}`,
    );
  }
}
