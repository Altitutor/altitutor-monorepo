import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

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
  const planName = stored.plan_tier === "pro" ? "UCAT Pro" : "UCAT Unlimited";
  const manageUrl = `${Deno.env.get("UCAT_WEB_URL")?.replace(/\/$/, "") ?? "https://ucat.altitutor.com"}/settings/plan/subscription`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Altitutor <noreply@altitutor.com>",
      to: student.email,
      subject: `Your ${planName} trial ends on ${trialEnd}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1f2937;line-height:1.6">
          <h1 style="color:#0a2941">Your UCAT trial ends soon</h1>
          <p>Hi ${student.first_name || "there"},</p>
          <p>Your trial ends on <strong>${trialEnd}</strong>. Your selected ${planName} subscription will then begin unless you cancel.</p>
          <div style="background:#f7f4ec;border-radius:12px;padding:20px;margin:24px 0">
            <p style="margin:0 0 8px"><strong>Standard price:</strong> ${money(price.base_price_cents, currency)}</p>
            <p style="margin:0 0 8px"><strong>Practice discounts earned:</strong> ${money(earnedCents, currency)}</p>
            <p style="margin:0"><strong>Current estimated first bill:</strong> ${money(estimatedCents, currency)}</p>
          </div>
          <p>You can continue earning practice-day discounts before the trial ends by completing ${config?.min_questions_per_day ?? 20}+ questions in a day.</p>
          <p><a href="${manageUrl}" style="display:inline-block;background:#0a2941;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Manage subscription</a></p>
          <p style="color:#6b7280;font-size:13px">Your final bill may be lower if you earn more practice-day discounts before billing.</p>
        </div>
      `,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Resend returned ${response.status}: ${await response.text()}`,
    );
  }
}
