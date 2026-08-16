import {
  renderTransactionalEmail,
  type TransactionalEmailRow,
} from "./email.ts";

const templates = [
  "public_interest_supported_access_received",
  "public_interest_online_tutoring_waitlist_received",
  "public_interest_interview_training_waitlist_received",
  "referral_gift_received",
  "referral_access_gift_earned",
  "referral_billing_credit_earned",
  "referral_free_bill_earned",
  "subscription_activated",
  "subscription_cancellation_scheduled",
  "subscription_cancellation_reversed",
  "subscription_canceled",
] as const;

Deno.test("renders every UCAT transactional email", () => {
  for (const templateKey of templates) {
    const row: TransactionalEmailRow = {
      id: crypto.randomUUID(),
      student_id: crypto.randomUUID(),
      recipient_email: "student@example.com",
      template_key: templateKey,
      event_key: `test:${templateKey}`,
      attempt_count: 1,
      payload: {
        first_name: "Amelia",
        referrer_name: "Brian",
        duration_interval: "month",
        expires_at: "2026-08-16T00:00:00+09:30",
        amount_off_cents: 4900,
        trial_end: "2026-08-16T00:00:00+09:30",
        cancel_at: "2026-08-30T00:00:00+09:30",
        action_path: "/settings/plan/subscription",
      },
    };
    const email = renderTransactionalEmail(row);

    if (!email.subject || !email.html || !email.text) {
      throw new Error(`${templateKey} rendered an incomplete email`);
    }
    if (!email.html.includes("A not-for-profit initiative by Altitutor.")) {
      throw new Error(`${templateKey} did not use the shared UCAT shell`);
    }
    if (!email.tags.some((tag) => tag.name === "template")) {
      throw new Error(`${templateKey} is missing its Resend template tag`);
    }
  }
});
