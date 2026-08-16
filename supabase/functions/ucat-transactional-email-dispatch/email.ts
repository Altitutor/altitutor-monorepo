import {
  buildUcatEmailActionUrl,
  escapeEmailHtml,
  renderUcatEmail,
  renderUcatEmailButton,
  renderUcatEmailPanel,
  UCAT_EMAIL_SENDERS,
  type UcatEmailSender,
} from "../_shared/ucat-email.ts";

export type TransactionalEmailRow = {
  id: string;
  student_id: string | null;
  recipient_email: string;
  template_key: string;
  event_key: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

type RenderedTransactionalEmail = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  from: string;
  replyTo: string;
  tags: Array<{ name: string; value: string }>;
};

function value(payload: Record<string, unknown>, key: string): string {
  const item = payload[key];
  return typeof item === "string" ? item.trim() : "";
}

function firstName(payload: Record<string, unknown>): string {
  return value(payload, "first_name") || "there";
}

function duration(payload: Record<string, unknown>): "week" | "month" {
  return value(payload, "duration_interval") === "month" ? "month" : "week";
}

function formatDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Adelaide",
  });
}

function money(cents: unknown): string | null {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

function paragraph(copy: string): string {
  return `<p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">${
    escapeEmailHtml(copy)
  }</p>`;
}

function render(input: {
  row: TransactionalEmailRow;
  sender: UcatEmailSender;
  subject: string;
  previewText: string;
  heading: string;
  bodyHtml: string;
  text: string;
}): RenderedTransactionalEmail {
  const sender = UCAT_EMAIL_SENDERS[input.sender];
  return {
    subject: input.subject,
    previewText: input.previewText,
    html: renderUcatEmail({
      previewText: input.previewText,
      heading: input.heading,
      bodyHtml: input.bodyHtml,
    }),
    text:
      `${input.heading}\n\n${input.text}\n\nA not-for-profit initiative by Altitutor.\nQuestions? ${sender.replyTo}`,
    from: sender.from,
    replyTo: sender.replyTo,
    tags: [
      { name: "product", value: "ucat" },
      { name: "category", value: "transactional" },
      {
        name: "template",
        value: input.row.template_key.replaceAll(/[^a-zA-Z0-9_-]/g, "_"),
      },
    ],
  };
}

export function renderTransactionalEmail(
  row: TransactionalEmailRow,
): RenderedTransactionalEmail {
  const payload = row.payload ?? {};
  const name = firstName(payload);
  const actionPath = value(payload, "action_path") || "/dashboard";
  const actionUrl = buildUcatEmailActionUrl({
    path: actionPath,
    campaign: row.template_key,
    content: "primary_cta",
  });

  switch (row.template_key) {
    case "public_interest_supported_access_received": {
      const panel = renderUcatEmailPanel(`
        <p style="margin:0 0 8px"><strong class="email-strong" style="color:#1a1a1a">What happens next</strong></p>
        <p style="margin:0">The Altitutor team will review your application, contact you to arrange a short online interview, then let you know what support is available. Decisions are based on financial circumstances and the funding available at the time.</p>
      `);
      return render({
        row,
        sender: "formal",
        subject: "We received your supported-access application",
        previewText:
          "Your application is safely with the Altitutor team. Here is what happens next.",
        heading: "Your application is with us",
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            "Thank you for telling us about your circumstances. We have received your application for free or subsidised Altitutor UCAT Unlimited access.",
          ) +
          panel +
          paragraph(
            "You do not need to submit the form again. We will use the email address or phone number you provided if we need anything else.",
          ),
        text:
          `Hi ${name},\n\nWe received your application for free or subsidised Altitutor UCAT Unlimited access.\n\nThe Altitutor team will review it, contact you to arrange a short online interview, then let you know what support is available. Decisions are based on financial circumstances and the funding available at the time.\n\nYou do not need to submit the form again.`,
      });
    }

    case "public_interest_online_tutoring_waitlist_received":
      return render({
        row,
        sender: "founder",
        subject: "You’re on the Altitutor UCAT tutoring waitlist",
        previewText:
          "Matt will follow up as plans for one-to-one online UCAT tutoring develop.",
        heading: "You’re on the waitlist",
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            "Thanks for registering your interest in one-to-one online UCAT tutoring. I’ll follow up as the tutoring program takes shape and places become available.",
          ) +
          renderUcatEmailPanel(
            "Joining the waitlist is not a booking and does not commit you to anything. In the meantime, you can use Altitutor UCAT Free to begin practising and building a useful starting point.",
            "cream",
          ) +
          renderUcatEmailButton(
            buildUcatEmailActionUrl({
              path: "/signup",
              campaign: row.template_key,
              content: "start_free",
            }),
            "Start preparing free",
          ),
        text:
          `Hi ${name},\n\nThanks for registering your interest in one-to-one online UCAT tutoring. I’ll follow up as the program takes shape and places become available.\n\nJoining the waitlist is not a booking and does not commit you to anything.\n\nStart preparing free: ${
            buildUcatEmailActionUrl({
              path: "/signup",
              campaign: row.template_key,
              content: "start_free",
            })
          }`,
      });

    case "referral_gift_received": {
      const giftDuration = duration(payload);
      const referrer = value(payload, "referrer_name") || "A friend";
      const expiry = formatDate(value(payload, "expires_at"));
      return render({
        row,
        sender: "product",
        subject: `${referrer} sent you ${
          giftDuration === "month" ? "a free month" : "a free week"
        } of UCAT Unlimited`,
        previewText: `Review the gift by ${expiry}.`,
        heading: `${referrer} sent you a UCAT gift`,
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            `${referrer} has gifted you one free ${giftDuration} of Altitutor UCAT Unlimited.`,
          ) +
          renderUcatEmailPanel(
            `<strong class="email-strong" style="color:#1a1a1a">Review it by ${
              escapeEmailHtml(expiry)
            }.</strong><br>When you accept, we will show you exactly how the free access works before anything begins.`,
          ) +
          renderUcatEmailButton(actionUrl, "Review your gift"),
        text:
          `Hi ${name},\n\n${referrer} has gifted you one free ${giftDuration} of Altitutor UCAT Unlimited. Review it by ${expiry}.\n\nReview your gift: ${actionUrl}`,
      });
    }

    case "referral_access_gift_earned": {
      const giftDuration = duration(payload);
      return render({
        row,
        sender: "product",
        subject: `Your free ${giftDuration} of UCAT Unlimited is ready`,
        previewText:
          "Your friend accepted your gift. Start your reward whenever you are ready.",
        heading: `You earned a free ${giftDuration}`,
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            `Your friend accepted your UCAT Unlimited gift, so your own free ${giftDuration} of Unlimited is ready.`,
          ) +
          renderUcatEmailPanel(
            "Your reward will not begin until you choose to start it. Once active, you can practice without waiting or area limits for the full reward period.",
          ) +
          renderUcatEmailButton(actionUrl, `Start my free ${giftDuration}`),
        text:
          `Hi ${name},\n\nYour friend accepted your UCAT Unlimited gift, so your own free ${giftDuration} of Unlimited is ready. It will not begin until you choose to start it.\n\nStart your reward: ${actionUrl}`,
      });
    }

    case "referral_billing_credit_earned": {
      const credit = money(payload.amount_off_cents);
      return render({
        row,
        sender: "formal",
        subject: "You earned an Altitutor UCAT referral credit",
        previewText:
          "Your friend accepted your gift. The credit will be applied automatically.",
        heading: "Your referral credit is ready",
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            "Your friend accepted your UCAT Unlimited gift, so you have earned a one-month-equivalent credit towards your next annual bill.",
          ) +
          renderUcatEmailPanel(
            `${
              credit
                ? `<strong class="email-strong" style="color:#1a1a1a">Credit earned: ${
                  escapeEmailHtml(credit)
                }</strong><br>`
                : ""
            }You do not need to enter a code. The credit will be applied automatically to your next eligible renewal.`,
          ) +
          renderUcatEmailButton(actionUrl, "View referral rewards"),
        text: `Hi ${name},\n\nYour friend accepted your UCAT Unlimited gift. ${
          credit ? `You earned a ${credit} credit. ` : ""
        }It will be applied automatically to your next eligible annual renewal.\n\nView referral rewards: ${actionUrl}`,
      });
    }

    case "referral_free_bill_earned":
      return render({
        row,
        sender: "formal",
        subject: "Your next UCAT Unlimited bill is free",
        previewText:
          "Your friend accepted your gift. Your reward will be applied automatically at renewal.",
        heading: "Your next bill is free",
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            "Your friend accepted your UCAT Unlimited gift, so your next eligible renewal is free.",
          ) +
          renderUcatEmailPanel(
            "You do not need to enter a code or change your subscription. The reward will be applied automatically when the next eligible bill is created.",
          ) +
          renderUcatEmailButton(actionUrl, "View referral rewards"),
        text:
          `Hi ${name},\n\nYour friend accepted your UCAT Unlimited gift, so your next eligible renewal is free. The reward will be applied automatically.\n\nView referral rewards: ${actionUrl}`,
      });

    case "subscription_activated": {
      const trialEnd = formatDate(value(payload, "trial_end"));
      const isTrial = Boolean(value(payload, "trial_end"));
      return render({
        row,
        sender: "product",
        subject: isTrial
          ? "Your UCAT Unlimited trial has started"
          : "Your UCAT Unlimited access is active",
        previewText:
          "Your questions, mocks, learning and progress tools are ready.",
        heading: isTrial
          ? "Your Unlimited trial is active"
          : "Unlimited is active",
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            "You now have unrestricted access to Altitutor UCAT questions, sets, mocks, skill trainers, learning and progress tools.",
          ) +
          (isTrial
            ? renderUcatEmailPanel(
              `Your trial ends on <strong class="email-strong" style="color:#1a1a1a">${
                escapeEmailHtml(trialEnd)
              }</strong>. We will send you a separate reminder showing your estimated first payment before then.`,
            )
            : "") +
          renderUcatEmailButton(actionUrl, "Continue my study plan"),
        text:
          `Hi ${name},\n\nYour UCAT Unlimited access is active. You now have unrestricted access to questions, sets, mocks, skill trainers, learning and progress tools.${
            isTrial ? `\n\nYour trial ends on ${trialEnd}.` : ""
          }\n\nContinue your study plan: ${actionUrl}`,
      });
    }

    case "subscription_cancellation_scheduled": {
      const cancelAt = formatDate(value(payload, "cancel_at"));
      return render({
        row,
        sender: "formal",
        subject: `Your UCAT Unlimited access will end on ${cancelAt}`,
        previewText:
          "Your access continues until then, and your practice history will remain safe.",
        heading: "Your change to Free is scheduled",
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            `Your UCAT Unlimited subscription is scheduled to end on ${cancelAt}. You can continue using Unlimited until then.`,
          ) +
          renderUcatEmailPanel(
            "After that date, you will move to UCAT Free. Your account, study plan, attempts, results and progress history will remain safe.",
          ) +
          renderUcatEmailButton(actionUrl, "Review subscription"),
        text:
          `Hi ${name},\n\nYour UCAT Unlimited subscription is scheduled to end on ${cancelAt}. You can continue using Unlimited until then. After that, you will move to Free and your history will remain safe.\n\nReview subscription: ${actionUrl}`,
      });
    }

    case "subscription_cancellation_reversed":
      return render({
        row,
        sender: "formal",
        subject: "Your UCAT Unlimited subscription will continue",
        previewText: "The scheduled cancellation has been removed.",
        heading: "Unlimited will continue",
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            "The scheduled cancellation has been removed. Your UCAT Unlimited subscription and access will continue as normal.",
          ) +
          renderUcatEmailButton(actionUrl, "Review subscription"),
        text:
          `Hi ${name},\n\nThe scheduled cancellation has been removed. Your UCAT Unlimited subscription and access will continue as normal.\n\nReview subscription: ${actionUrl}`,
      });

    case "subscription_canceled":
      return render({
        row,
        sender: "formal",
        subject: "You have moved to Altitutor UCAT Free",
        previewText:
          "Your account, study plan, attempts and progress history are safe.",
        heading: "You’re now on UCAT Free",
        bodyHtml: paragraph(`Hi ${name},`) +
          paragraph(
            "Your UCAT Unlimited subscription has ended and your account has moved to UCAT Free.",
          ) +
          renderUcatEmailPanel(
            "Your study plan, question attempts, results and progress history are safe. Free allowances reset, so you can continue preparing without losing your work.",
          ) +
          renderUcatEmailButton(actionUrl, "Continue preparing"),
        text:
          `Hi ${name},\n\nYour UCAT Unlimited subscription has ended and your account has moved to UCAT Free. Your study plan, attempts, results and progress history are safe.\n\nContinue preparing: ${actionUrl}`,
      });
  }

  throw new Error(`Unsupported transactional template: ${row.template_key}`);
}
