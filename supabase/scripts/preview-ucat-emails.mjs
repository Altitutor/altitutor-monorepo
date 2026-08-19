import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const workspace = process.cwd();
const port = Number(process.env.UCAT_EMAIL_PREVIEW_PORT || 4187);
const previewVersion = process.env.UCAT_EMAIL_PREVIEW_VERSION || `${Date.now()}`;

const moduleCache = new Map();

function loadTypescriptModule(path, transform = (source) => source) {
  const absolutePath = resolve(workspace, path);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath);

  const source = transform(readFileSync(absolutePath, "utf8"));
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(absolutePath, module.exports);
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".")) {
      throw new Error(`Preview loader cannot import ${specifier}`);
    }
    const resolved = resolve(dirname(absolutePath), specifier);
    return loadTypescriptModule(
      existsSync(resolved) ? resolved : `${resolved}.ts`,
    );
  };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    Date,
    Intl,
    URL,
    URLSearchParams,
    crypto,
    encodeURIComponent,
    Deno: {
      env: {
        get(name) {
          if (name === "UCAT_WEB_URL") return "https://ucat.altitutor.com";
          if (name === "MARKETING_WEB_URL") return `http://127.0.0.1:${port}`;
          if (name === "UCAT_FOUNDER_SIGNATURE_URL") {
            return `http://127.0.0.1:${port}/__matt_signature`;
          }
          return undefined;
        },
      },
    },
  });
  moduleCache.set(absolutePath, module.exports);
  return module.exports;
}

const lifecycle = loadTypescriptModule(
  "supabase/functions/ucat-lifecycle-emails/email.ts",
  (source) =>
    source.replace(
      /const APP_URL = \(Deno\.env[\s\S]*?\.replace\(\/\\\/$\/, ""\);/,
      'const APP_URL = "https://ucat.altitutor.com";',
    ),
);

const transactional = loadTypescriptModule(
  "supabase/functions/stripe-webhooks/shared/ucat-transactional-email.ts",
);
const transactionalDispatch = loadTypescriptModule(
  "supabase/functions/ucat-transactional-email-dispatch/email.ts",
);
const sharedEmail = loadTypescriptModule("packages/email/src/index.ts");

const EMAIL_SETTINGS = {
  weekly: "Weekly progress and study guidance",
  lessons: "UCAT lessons and preparation tips",
  required: "Required service email — cannot opt out",
};

const lifecycleCampaigns = [
  ["onboarding_starting_point", "Onboarding 1 · Starting point", "At 9 am local time around signup day 0; delayed when a higher-priority message is due.", EMAIL_SETTINGS.lessons],
  ["onboarding_technique", "Onboarding 2 · Technique", "At 9 am local time around signup day 2, after lesson one.", EMAIL_SETTINGS.lessons],
  ["onboarding_timing", "Onboarding 3 · Timing", "At 9 am local time around signup day 5, after lesson two.", EMAIL_SETTINGS.lessons],
  ["onboarding_plan", "Onboarding 4 · Attempt review", "At 9 am local time around signup day 9, after lesson three.", EMAIL_SETTINGS.lessons],
  ["first_score_estimate", "Progress · category breakdown", "Once, within 48 hours of the first estimate becoming available. Teaches Progress; does not include the student's score.", EMAIL_SETTINGS.weekly],
  ["weekly_review", "Weekly review", "Sunday afternoon local time after at least 10 questions, one set, or one mock.", EMAIL_SETTINGS.weekly],
  ["gentle_restart", "Gentle restart", "At 9 am local time after seven to nine inactive days, no more than once per 30 days.", EMAIL_SETTINGS.weekly],
  ["upgrade_quota", "Upgrade · quota", "A Free student, 24 hours after reaching an allowance, with a shared 30-day upgrade cooldown.", "Offers and referrals"],
  ["upgrade_consistency", "Upgrade · consistency", "A Free student with at least two qualifying practice days in seven, with a shared 30-day upgrade cooldown.", "Offers and referrals"],
  ["referral_invitation", "Unlimited referral", "An Unlimited student with a value moment, no open reward, and a 60-day cooldown.", "Offers and referrals"],
];

const previews = new Map();
for (const [key, label, sentWhen, setting] of lifecycleCampaigns) {
  const rendered = lifecycle.buildLifecyclePreview(key, "new");
  previews.set(`lifecycle-${key}`, {
    source: "Supabase: ucat-lifecycle-emails",
    group: "Lifecycle",
    label,
    subject: rendered.subject,
    html: rendered.html,
    sentWhen,
    setting,
  });
}

for (const familiarity of ["familiar", "experienced"]) {
  for (const [key, label, sentWhen, setting] of lifecycleCampaigns.slice(0, 4)) {
    const rendered = lifecycle.buildLifecyclePreview(key, familiarity);
    previews.set(`lifecycle-${key}-${familiarity}`, {
      source: "Supabase: ucat-lifecycle-emails",
      group: "Lifecycle · onboarding variants",
      label: `${label} · ${familiarity}`,
      subject: rendered.subject,
      html: rendered.html,
      sentWhen,
      setting,
    });
  }
}

previews.set("transactional-access-ended", {
  source: "Supabase: stripe-webhooks",
  group: "Billing & account",
  label: "Unlimited access ended",
  subject: "Your Altitutor UCAT Unlimited subscription has ended",
  sentWhen:
    "After payment recovery has been attempted and the UCAT subscription reaches a terminal unpaid or payment-failed cancellation state. Sent once per subscription.",
  setting: EMAIL_SETTINGS.required,
  html: transactional.renderUcatTransactionalEmail({
    previewText: "Your practice history is safe, and you can keep preparing on Free.",
    heading: "Your Unlimited access has ended",
    bodyHtml: `<p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">Hi Alex,</p><p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">We could not recover your subscription payment after several attempts, so your Altitutor UCAT Unlimited subscription has ended.</p><table class="email-panel" role="presentation" width="100%" style="margin:24px 0;background:#eaf1f3;border:1px solid #d1e0e5;border-radius:12px"><tr><td class="email-panel-copy" style="padding:18px 20px;color:#394650;font-size:14px;line-height:1.65"><strong class="email-strong" style="color:#1a1a1a">Your account, practice history and results are safe.</strong> You can keep preparing on Free or restart Unlimited whenever you are ready.</td></tr></table>`,
  }),
});

previews.set("transactional-trial-ending", {
  source: "Supabase: stripe-webhooks",
  group: "Billing & account",
  label: "Trial ending soon",
  subject: "Your Altitutor UCAT Unlimited trial ends on 16 August 2026",
  sentWhen:
    "When Stripe emits its trial-will-end event for an Unlimited trial. Suppressed addresses are skipped.",
  setting: EMAIL_SETTINGS.required,
  html: transactional.renderUcatTransactionalEmail({
    previewText:
      "Your Unlimited trial ends on 16 August. Review your estimated first payment.",
    heading: "Your Unlimited trial ends soon",
    bodyHtml:
      `<p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">Hi Alex,</p><p style="margin:0;color:#394650;font-size:15px;line-height:1.7">Your Altitutor UCAT Unlimited trial ends on <strong class="email-accent" style="color:#1a1a1a">16 August 2026</strong>. Your subscription will begin after the trial unless you cancel.</p>${transactional.renderUcatEmailPanel("<strong class=\"email-accent\" style=\"color:#1a1a1a\">Current estimated first payment: $39.00</strong><br>Your final payment may be lower if you earn more practice-day discounts before billing.")}${transactional.renderUcatEmailButton("https://ucat.altitutor.com/settings/plan/subscription?utm_source=altitutor&utm_medium=email&utm_campaign=ucat_trial_ending", "Review subscription")}`,
  }),
});

const transactionalTemplates = [
  [
    "public_interest_supported_access_received",
    "Supported access received",
    "Immediately after someone submits the supported-access application form.",
    EMAIL_SETTINGS.required,
  ],
  [
    "public_interest_online_tutoring_waitlist_received",
    "Tutoring waitlist received",
    "Immediately after someone joins the one-to-one online tutoring waitlist.",
    EMAIL_SETTINGS.required,
  ],
  [
    "public_interest_interview_training_waitlist_received",
    "Interview training waitlist received",
    "Immediately after someone joins the medical interview training waitlist.",
    EMAIL_SETTINGS.required,
  ],
  [
    "public_interest_admin_notification",
    "Landing page enquiry (admin)",
    "Immediately after any supported-access application or waitlist signup on the UCAT landing page.",
    EMAIL_SETTINGS.required,
  ],
  [
    "referral_gift_received",
    "Friend received a gift",
    "When a referral gift is created for the invited student, before they accept it.",
    EMAIL_SETTINGS.required,
  ],
  [
    "referral_access_gift_earned",
    "Free access reward earned",
    "When a friend accepts the referral gift and a free Unlimited access reward is created for the referrer.",
    EMAIL_SETTINGS.required,
  ],
  [
    "referral_billing_credit_earned",
    "Annual credit earned",
    "When an eligible paid referral creates a fixed credit towards the referrer’s next annual renewal.",
    EMAIL_SETTINGS.required,
  ],
  [
    "referral_free_bill_earned",
    "Free bill earned",
    "When an eligible paid referral creates a reward that makes the referrer’s next annual renewal free.",
    EMAIL_SETTINGS.required,
  ],
  [
    "subscription_activated",
    "Unlimited activated",
    "After a successful UCAT checkout provisions an active or trialling Unlimited subscription and any referral checks pass.",
    EMAIL_SETTINGS.required,
  ],
  [
    "subscription_cancellation_scheduled",
    "Cancellation scheduled",
    "When Stripe changes an active UCAT subscription from continuing to cancel-at-period-end.",
    EMAIL_SETTINGS.required,
  ],
  [
    "subscription_cancellation_reversed",
    "Cancellation reversed",
    "When a scheduled cancellation is removed while the UCAT subscription remains active, trialling, or past due.",
    EMAIL_SETTINGS.required,
  ],
  [
    "subscription_canceled",
    "Moved to Free",
    "When Stripe deletes a UCAT subscription for a non-payment-failure cancellation. Payment-failure endings use the separate access-ended email.",
    EMAIL_SETTINGS.required,
  ],
];

for (const [templateKey, label, sentWhen, setting] of transactionalTemplates) {
  const payload =
    templateKey === "public_interest_admin_notification"
      ? {
          submission_id: "00000000-0000-4000-8000-000000000001",
          kind: "supported_access",
          name: "Alex Morgan",
          email: "alex.morgan@example.com",
          phone: "+61412345678",
          reason:
            "Example supported-access application submitted from the UCAT landing page preview.",
          source: "ucat_landing_page",
        }
      : {
          first_name: "Alex",
          referrer_name: "Brian",
          duration_interval: "month",
          expires_at: "2026-08-16T00:00:00+09:30",
          amount_off_cents: 4900,
          trial_end: "2026-08-16T00:00:00+09:30",
          cancel_at: "2026-08-30T00:00:00+09:30",
          action_path: "/settings/plan/subscription",
        };
  const rendered = transactionalDispatch.renderTransactionalEmail({
    id: `preview-${templateKey}`,
    student_id: "preview-student",
    recipient_email:
      templateKey === "public_interest_admin_notification"
        ? "admin@altitutor.com"
        : "student@example.com",
    template_key: templateKey,
    event_key: `preview:${templateKey}`,
    attempt_count: 1,
    payload,
  });
  previews.set(`transactional-${templateKey}`, {
    source: "Supabase: ucat-transactional-email-dispatch",
    group: templateKey.startsWith("referral_") ? "Referrals" : "Billing & account",
    label,
    subject: rendered.subject,
    html: rendered.html,
    sentWhen,
    setting,
  });
}

const corePreviews = [
  {
    key: "invitation",
    source: "admin-web",
    group: "Core tutoring · access",
    label: "Account invitation",
    sentWhen: "When staff invite a Student, tutor, or staff member to create an Altitutor account.",
    email: sharedEmail.buildInvitationEmail({
      recipientName: "Alex Morgan",
      inviteUrl: "https://student.altitutor.com/invite/preview-token",
      staffIntroduction: "It was lovely meeting you. Use the invitation below when you are ready.",
    }),
  },
  {
    key: "registration",
    source: "admin-web",
    group: "Core tutoring · access",
    label: "Student registration",
    sentWhen: "When a Student or parent is asked to complete in-person registration.",
    email: sharedEmail.buildRegistrationEmail({
      recipientName: "Jamie Morgan",
      studentName: "Alex Morgan",
      registrationUrl: "https://student.altitutor.com/register/preview-token",
      staffIntroduction: "Thanks for attending the trial session.",
    }),
  },
  {
    key: "booking-confirmation",
    source: "admin-web",
    group: "Core tutoring · bookings",
    label: "Booking confirmation",
    sentWhen: "When staff send a booking confirmation to the configured recipients.",
    email: sharedEmail.buildBookingConfirmationEmail({
      recipientName: "Alex Morgan",
      studentName: "Alex Morgan",
      sessionDate: "Monday, 10 August 2026",
      sessionTime: "4:00 pm–5:00 pm",
      bookingUrl: "https://student.altitutor.com/booking/preview-token",
      staffIntroduction: "Looking forward to seeing you.",
    }),
  },
  {
    key: "booking-changed",
    source: "student-web",
    group: "Core tutoring · bookings",
    label: "Booking changed",
    sentWhen: "After a public trial booking is rescheduled.",
    email: sharedEmail.buildBookingChangedEmail({
      recipientName: "Alex Morgan",
      sessionDate: "Monday, 10 August 2026",
      sessionTime: "4:00 pm–5:00 pm",
      bookingUrl: "https://student.altitutor.com/booking/preview-token",
    }),
  },
  {
    key: "booking-cancelled",
    source: "student-web",
    group: "Core tutoring · bookings",
    label: "Booking cancelled",
    sentWhen: "After a public trial booking is cancelled.",
    email: sharedEmail.buildBookingCancelledEmail({
      recipientName: "Alex Morgan",
      sessionDate: "Monday, 10 August 2026",
      sessionTime: "4:00 pm–5:00 pm",
    }),
  },
  {
    key: "invoice-notification",
    source: "billing-runner / admin-web",
    group: "Core tutoring · billing",
    label: "Invoice ready",
    sentWhen: "When a manual-payment invoice is finalised, or when staff resend its notification.",
    email: sharedEmail.buildInvoiceNotificationEmail({
      invoiceNumber: "ALT-1042",
      invoiceDate: "8 August 2026",
      dueDate: "15 August 2026",
      amount: "AUD $245.00",
      hostedInvoiceUrl: "https://invoice.stripe.com/i/preview",
      invoicePdfUrl: "https://pay.stripe.com/invoice/preview/pdf",
    }),
  },
];

for (const preview of corePreviews) {
  previews.set(`core-${preview.key}`, {
    source: preview.source,
    group: preview.group,
    label: preview.label,
    subject: preview.email.subject,
    html: preview.email.html,
    sentWhen: preview.sentWhen,
    setting: EMAIL_SETTINGS.required,
  });
}

const authTemplates = [
  [
    "confirmation",
    "Confirm signup",
    "When a new email-and-password signup must confirm ownership of the email address.",
    EMAIL_SETTINGS.required,
  ],
  [
    "recovery",
    "Reset password",
    "When someone requests a password reset for their shared Altitutor identity.",
    EMAIL_SETTINGS.required,
  ],
  [
    "magic_link",
    "Magic link",
    "When someone requests passwordless email sign-in.",
    EMAIL_SETTINGS.required,
  ],
  [
    "invite",
    "Invitation",
    "When an Altitutor administrator or authorised workflow invites a user.",
    EMAIL_SETTINGS.required,
  ],
  [
    "email_change",
    "Confirm email change",
    "When a signed-in user asks to change the email address on their account.",
    EMAIL_SETTINGS.required,
  ],
  [
    "reauthentication",
    "Reauthentication",
    "When Supabase requires a fresh verification code before a sensitive account action.",
    EMAIL_SETTINGS.required,
  ],
];

for (const [file, label, sentWhen, setting] of authTemplates) {
  const source = readFileSync(resolve(workspace, `supabase/templates/${file}.html`), "utf8")
    .replaceAll("{{ .ConfirmationURL }}", "https://ucat.altitutor.com/auth/callback?token=preview")
    .replaceAll("{{ .RedirectTo }}", "https://ucat.altitutor.com/auth/reset-password")
    .replaceAll("{{ .TokenHash }}", "preview-token-hash")
    .replaceAll("{{ .SiteURL }}", "https://ucat.altitutor.com")
    .replaceAll("{{ .Email }}", "student@example.com")
    .replaceAll("{{ .NewEmail }}", "alex.new@example.com")
    .replaceAll("{{ .Token }}", "123456")
    .replaceAll("__CURRENT_YEAR__", String(new Date().getUTCFullYear()));
  previews.set(`auth-${file}`, {
    source: "Supabase Auth (shared)",
    group: "Account access",
    label,
    subject: label,
    html: source,
    sentWhen,
    setting,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function removeDarkMediaQueries(html) {
  const pattern =
    /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/gi;
  let output = html;
  let match;

  while ((match = pattern.exec(output))) {
    let depth = 1;
    let cursor = match.index + match[0].length;
    while (cursor < output.length && depth > 0) {
      if (output[cursor] === "{") depth += 1;
      if (output[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    if (depth !== 0) break;
    output = `${output.slice(0, match.index)}${output.slice(cursor)}`;
    pattern.lastIndex = match.index;
  }

  return output;
}

function insertBeforeHeadClose(html, content) {
  return html.includes("</head>")
    ? html.replace("</head>", `${content}</head>`)
    : `${content}${html}`;
}

function forceLightTheme(html) {
  const withoutDarkMedia = removeDarkMediaQueries(html);
  return insertBeforeHeadClose(
    withoutDarkMedia,
    `<meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style id="preview-light-theme">:root{color-scheme:light!important;supported-color-schemes:light!important}</style>`,
  );
}

function forceDarkTheme(html) {
  const css = `<style id="preview-dark-theme">
    :root{color-scheme:dark!important;supported-color-schemes:dark!important}
    body,.email-page,.email-bg{background-color:#171717!important}
    .email-card,.email-content,.email-header{background-color:#1f1f1f!important;border-color:#2b2b2b!important}
    .email-heading,.email-title,.email-strong,.email-panel .email-strong{color:#fff!important}
    .email-copy,.email-copy p,.email-copy li,.email-copy td{color:#f5f5f5!important}
    .email-panel{background-color:#262626!important;border-color:#2b2b2b!important}
    .email-footer{background-color:#262626!important;border-color:#2b2b2b!important}
    .email-module-surface{background-color:#2b2b2b!important;border-color:#2b2b2b!important}
    .email-panel td,.email-panel-copy,.email-panel-copy p,.email-panel-copy td{color:#f5f5f5!important}
    .email-footer p,.email-muted,.email-brand-subtitle,.email-panel .email-muted{color:#b3b3b3!important}
    a,a.email-link,.email-brand,.email-link,.email-footer-title,.email-accent,.email-content a,.email-copy a,.email-muted a,.email-panel a,.email-panel-copy .email-accent,.email-panel .email-accent,.email-footer a{color:#b7d4df!important}
    .email-button-cell{background-color:#92b5c3!important}
    a.email-button,.email-button,.email-content a.email-button,.email-copy a.email-button,.email-button-cell a{color:#1c1c1c!important}
    .email-accent-fill{background-color:#92b5c3!important;color:#1c1c1c!important}
    .email-signature{filter:invert(1)!important;-webkit-filter:invert(1)!important}
  </style>`;
  return insertBeforeHeadClose(
    html,
    `<meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  ${css}`,
  );
}

function withLiveReload(html) {
  const script = `<script>
    (() => {
      const renderedVersion = ${JSON.stringify(previewVersion)};
      const check = async () => {
        try {
          const response = await fetch("/__preview_version", { cache: "no-store" });
          if (response.ok && (await response.text()) !== renderedVersion) {
            location.reload();
          }
        } catch {}
      };
      setInterval(check, 500);
    })();
  </script>`;
  return html.includes("</body>")
    ? html.replace("</body>", `${script}</body>`)
    : `${html}${script}`;
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function primaryCta(html) {
  const anchor = html.match(
    /<a\b(?=[^>]*class=["'][^"']*\bemail-button\b)[^>]*>[\s\S]*?<\/a>/i,
  )?.[0];
  if (!anchor) return null;

  const href = anchor.match(/\bhref=(["'])([\s\S]*?)\1/i)?.[2];
  if (!href) return null;

  const label = anchor
    .replace(/^<a\b[^>]*>/i, "")
    .replace(/<\/a>$/i, "")
    .replace(/<[^>]+>/g, "")
    .trim();

  return {
    href: decodeHtmlAttribute(href),
    label: label || "Open link",
  };
}

function displayCtaHref(href) {
  try {
    const url = new URL(href);
    return `${url.pathname}${url.search}${url.hash}` || url.origin;
  } catch {
    return href;
  }
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
}

function galleryToolbarConfig() {
  const items = [...previews.values()];
  const optionList = (values) =>
    uniqueSorted(values).map((value) => ({ value, label: value }));

  return {
    columns: [
      { key: "email", label: "Email" },
      { key: "source", label: "Source app" },
      { key: "category", label: "Category" },
      { key: "sentWhen", label: "Sent when" },
      { key: "setting", label: "Email setting" },
      { key: "cta", label: "Primary CTA link" },
      { key: "preview", label: "Preview" },
    ],
    searchFrom: [
      { value: "email", label: "Email" },
      { value: "source", label: "Source app" },
      { value: "category", label: "Category" },
      { value: "sentWhen", label: "Sent when" },
      { value: "setting", label: "Email setting" },
      { value: "cta", label: "Primary CTA link" },
    ],
    sortOptions: [
      { key: "email", label: "Email" },
      { key: "subject", label: "Subject" },
      { key: "source", label: "Source app" },
      { key: "category", label: "Category" },
      { key: "sentWhen", label: "Sent when" },
      { key: "setting", label: "Email setting" },
      { key: "cta", label: "Primary CTA" },
    ],
    filters: [
      {
        key: "category",
        label: "Category",
        options: optionList(items.map((item) => item.group)),
      },
      {
        key: "source",
        label: "Source app",
        options: optionList(items.map((item) => item.source)),
      },
      {
        key: "setting",
        label: "Email setting",
        options: optionList(items.map((item) => item.setting)),
      },
      {
        key: "hasCta",
        label: "Primary CTA",
        options: [
          { value: "yes", label: "Has a primary CTA" },
          { value: "no", label: "No primary CTA" },
        ],
      },
    ],
  };
}

function previewTableRow([key, item], index) {
  const cta = primaryCta(item.html);
  const ctaSearch = cta ? `${cta.label} ${displayCtaHref(cta.href)}` : "";
  const ctaCell = cta
    ? `<a class="cta-link" href="${escapeHtml(cta.href)}" target="_blank" rel="noreferrer">
        <span>${escapeHtml(cta.label)}</span>
        <code>${escapeHtml(displayCtaHref(cta.href))}</code>
      </a>`
    : '<span class="no-cta">No primary CTA</span>';

  return `<tr
    data-index="${index}"
    data-label="${escapeHtml(item.label)}"
    data-subject="${escapeHtml(item.subject)}"
    data-email="${escapeHtml(`${item.label} ${item.subject}`)}"
    data-source="${escapeHtml(item.source)}"
    data-category="${escapeHtml(item.group)}"
    data-sent-when="${escapeHtml(item.sentWhen)}"
    data-setting="${escapeHtml(item.setting)}"
    data-cta="${escapeHtml(ctaSearch)}"
    data-has-cta="${cta ? "yes" : "no"}"
  >
    <td data-col="email">
      <span class="tag">${escapeHtml(item.label)}</span>
      <div class="subject">${escapeHtml(item.subject)}</div>
    </td>
    <td data-col="source"><span class="source">${escapeHtml(item.source)}</span></td>
    <td data-col="category"><span class="category">${escapeHtml(item.group)}</span></td>
    <td data-col="sentWhen" class="condition">${escapeHtml(item.sentWhen)}</td>
    <td data-col="setting"><span class="setting ${
    item.setting === EMAIL_SETTINGS.required ? "setting-required" : ""
  }">${escapeHtml(item.setting)}</span></td>
    <td data-col="cta">${ctaCell}</td>
    <td data-col="preview">
      <div class="links">
        <a href="/preview/${encodeURIComponent(key)}?theme=light" target="_blank">Light</a>
        <a href="/preview/${encodeURIComponent(key)}?theme=dark" target="_blank">Dark</a>
        <a href="/preview/${encodeURIComponent(key)}?theme=light&viewport=mobile" target="_blank">Mobile</a>
      </div>
    </td>
  </tr>`;
}

function gallery() {
  const toolbarConfig = JSON.stringify(galleryToolbarConfig()).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>Altitutor email previews</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#f2f0e9;color:#1a1a1a;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:1440px;margin:auto;padding:56px 24px}
      h1{margin:0;color:#0a2941;font-size:36px;letter-spacing:-1px}
      p{color:#52606a}
      .intro{max-width:800px}
      .coverage{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:30px 0 18px}
      .coverage-item{border:1px solid #d5dee1;border-radius:12px;background:#fff;padding:15px 17px;color:#52606a;font-size:13px}
      .coverage-item strong{display:block;margin-bottom:3px;color:#0a2941}
      .coverage-unused{background:#f8f6f0}
      .toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px}
      .toolbar-search{display:flex;flex:1;align-items:center;min-width:min(100%,240px);height:40px;padding:0 8px;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgba(10,41,65,.06),0 0 0 1px rgba(10,41,65,.08)}
      .toolbar-search:focus-within{box-shadow:0 1px 2px rgba(10,41,65,.06),0 0 0 2px rgba(10,41,65,.18)}
      .toolbar-search input{flex:1;min-width:0;height:100%;border:0;background:transparent;color:#1a1a1a;font:inherit;outline:none}
      .toolbar-search input::placeholder{color:#8a9297}
      .search-from-wrap{position:relative;flex-shrink:0}
      .search-from-btn,.icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:28px;padding:0 8px;border:0;border-radius:999px;background:#edf2f3;color:#52606a;font:12px/1 inherit;cursor:pointer}
      .search-from-btn:hover,.icon-btn:hover,.search-from-wrap.is-open .search-from-btn{background:#e0eaee;color:#0a2941}
      .search-from-label{max-width:9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .icon-btn{width:28px;padding:0;background:transparent}
      .toolbar-actions{display:flex;flex-shrink:0;align-items:center;gap:8px}
      .toolbar-menu{position:relative;display:flex;align-items:center}
      .toolbar-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 12px;border:0;border-radius:12px;background:#fff;box-shadow:0 1px 2px rgba(10,41,65,.06),0 0 0 1px rgba(10,41,65,.08);color:#1a1a1a;font:13px/1 inherit;cursor:pointer}
      .toolbar-btn:hover,.toolbar-menu.is-open .toolbar-btn{background:#eaf1f3}
      .toolbar-dropdown{position:absolute;top:calc(100% + 6px);right:0;z-index:30;display:none;width:240px;max-height:min(70vh,480px);overflow:auto;padding:6px 0;border-radius:12px;background:#fff;box-shadow:0 12px 32px rgba(10,41,65,.14),0 0 0 1px rgba(10,41,65,.08)}
      .search-from-wrap .toolbar-dropdown{left:0;right:auto;width:220px}
      .toolbar-menu.is-open > .toolbar-dropdown,.search-from-wrap.is-open > .toolbar-dropdown{display:block}
      .menu-label{padding:8px 12px;color:#52606a;font-size:12px;font-weight:600}
      .menu-label.subtle{padding-top:10px;color:#8a9297;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
      .menu-divider{height:1px;margin:4px 0;background:#e1e7e9}
      .check-row{display:flex;align-items:flex-start;gap:8px;padding:8px 12px;color:#1a1a1a;font-size:13px;line-height:1.35;cursor:pointer}
      .check-row:hover{background:#f4f7f8}
      .check-row input{margin:2px 0 0}
      .sort-row{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:0;background:transparent;color:#1a1a1a;font:13px/1.35 inherit;text-align:left;cursor:pointer}
      .sort-row:hover,.sort-row.is-selected{background:#f4f7f8}
      .sort-row-label{flex:1;min-width:0}
      .sort-dir{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border-radius:8px;background:#fff;box-shadow:0 0 0 1px rgba(10,41,65,.1);color:#52606a;font-size:12px}
      .clear-all{display:flex;align-items:center;gap:6px;margin:0 8px 6px;padding:6px 8px;border:1px solid #d5dee1;border-radius:8px;background:#f4f7f8;color:#234c5d;font:12px/1 inherit;cursor:pointer}
      .clear-all:hover{background:#eaf1f3}
      .toolbar-badge{position:absolute;top:-6px;right:-6px;z-index:2;display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border:0;border-radius:999px;background:#0a2941;box-shadow:0 0 0 2px #f2f0e9;color:#fff;font:600 11px/1 inherit;cursor:pointer}
      .toolbar-badge .badge-x{display:none}
      .toolbar-badge:hover{background:#b42318}
      .toolbar-badge:hover .badge-count{display:none}
      .toolbar-badge:hover .badge-x{display:inline-flex}
      .badge-sort{display:inline-flex;max-width:7rem;align-items:center;gap:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .icon{width:16px;height:16px;flex-shrink:0}
      .result-count{margin:0 0 10px;font-size:12px}
      .table-wrap{overflow-x:auto;border:1px solid #d5dee1;border-radius:16px;background:#fff;box-shadow:0 7px 24px rgba(10,41,65,.05)}
      table{width:100%;min-width:1480px;border-collapse:collapse}
      th{padding:13px 16px;background:#eaf1f3;color:#52606a;font-size:11px;letter-spacing:.08em;text-align:left;text-transform:uppercase}
      td{padding:17px 16px;border-top:1px solid #e1e7e9;vertical-align:top}
      tbody tr:hover{background:#fbfcfc}
      tbody tr[hidden]{display:none}
      th[data-col="email"]{width:19%}
      th[data-col="source"]{width:13%}
      th[data-col="category"]{width:9%}
      th[data-col="sentWhen"]{width:23%}
      th[data-col="setting"]{width:16%}
      th[data-col="cta"]{width:14%}
      th[data-col="preview"]{width:6%}
      table.col-hide-email [data-col="email"],
      table.col-hide-source [data-col="source"],
      table.col-hide-category [data-col="category"],
      table.col-hide-sentWhen [data-col="sentWhen"],
      table.col-hide-setting [data-col="setting"],
      table.col-hide-cta [data-col="cta"],
      table.col-hide-preview [data-col="preview"]{display:none}
      .empty-cell{padding:36px 16px;color:#8a9297;text-align:center}
      .tag{font:10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.12em;color:#527487}
      .subject{margin-top:5px;font-weight:700;color:#0a2941}
      .source{color:#234c5d;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
      .category{display:inline-block;border-radius:999px;background:#edf2f3;padding:5px 9px;color:#52606a;font-size:11px;white-space:nowrap}
      .condition{color:#52606a;font-size:13px;line-height:1.55}
      .setting{display:inline-block;border-radius:8px;background:#e8f1f4;padding:6px 9px;color:#234c5d;font-size:12px;line-height:1.4}
      .setting-required{background:#f0f0ee;color:#5d625f}
      .cta-link{display:block;color:#0a2941;text-decoration:none;overflow-wrap:anywhere}
      .cta-link span{display:block;font-size:12px;font-weight:700}
      .cta-link code{display:block;margin-top:4px;color:#52606a;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
      .cta-link:hover span{text-decoration:underline}
      .no-cta{color:#8a9297;font-size:12px}
      .links{display:flex;gap:10px;white-space:nowrap}
      .links a{font-size:12px;color:#0a2941}
      .footnote{margin-top:14px;font-size:12px}
      @media(max-width:720px){
        main{padding:34px 16px}
        h1{font-size:30px}
        .coverage{grid-template-columns:1fr}
        .search-from-label{display:none}
        .toolbar-btn{width:40px;padding:0}
        .toolbar-btn-label{display:none}
      }
    </style>
  </head>
  <body>
    <main>
      <p class="tag">Local review tool</p>
      <h1>Altitutor emails</h1>
      <p class="intro">These previews render from the same core tutoring, shared identity, and UCAT templates used in production. No email is sent.</p>
      <div class="coverage">
        <div class="coverage-item">
          <strong>Four consent topics control optional email</strong>
          Lessons, progress guidance, product news, and offers/referrals are independently respected. Required account and billing email remains separate.
        </div>
        <div class="coverage-item coverage-unused">
          <strong>Product news stays deliberate</strong>
          Material product news is authored as a Resend Broadcast. Admin-web schedules a suppression window so automated lifecycle email waits its turn.
        </div>
      </div>
      <div class="toolbar">
        <div class="toolbar-search">
          <div class="search-from-wrap" id="search-from-wrap">
            <button type="button" class="search-from-btn" id="search-from-btn" aria-haspopup="true" aria-expanded="false" aria-label="Search from All fields">
              <span class="search-from-label" id="search-from-label">All fields</span>
            </button>
            <div class="toolbar-dropdown" id="search-from-menu" role="menu"></div>
          </div>
          <input id="email-search" type="text" placeholder="Search emails" autocomplete="off" spellcheck="false">
          <button type="button" class="icon-btn" id="search-clear" hidden aria-label="Clear search"></button>
        </div>
        <div class="toolbar-actions">
          <div class="toolbar-menu" id="view-wrap">
            <button type="button" class="toolbar-btn" id="view-btn" aria-haspopup="true" aria-expanded="false" aria-label="View options"><span class="toolbar-btn-label">View</span></button>
            <div class="toolbar-dropdown" id="view-menu"></div>
            <button type="button" class="toolbar-badge" id="view-badge" hidden aria-label="Reset column layout to default"><span class="badge-count"></span><span class="badge-x"></span></button>
          </div>
          <div class="toolbar-menu" id="sort-wrap">
            <button type="button" class="toolbar-btn" id="sort-btn" aria-haspopup="true" aria-expanded="false" aria-label="Sort"><span class="toolbar-btn-label">Sort</span></button>
            <div class="toolbar-dropdown" id="sort-menu"></div>
            <button type="button" class="toolbar-badge" id="sort-badge" hidden aria-label="Clear sort"><span class="badge-count"></span><span class="badge-x"></span></button>
          </div>
          <div class="toolbar-menu" id="filter-wrap">
            <button type="button" class="toolbar-btn" id="filter-btn" aria-haspopup="true" aria-expanded="false" aria-label="Filter"><span class="toolbar-btn-label">Filter</span></button>
            <div class="toolbar-dropdown" id="filter-menu"></div>
            <button type="button" class="toolbar-badge" id="filter-badge" hidden aria-label="Clear all filters"><span class="badge-count"></span><span class="badge-x"></span></button>
          </div>
        </div>
      </div>
      <p class="result-count" id="result-count"></p>
      <div class="table-wrap">
        <table id="email-table">
          <thead>
            <tr>
              <th data-col="email">Email</th>
              <th data-col="source">Source app</th>
              <th data-col="category">Category</th>
              <th data-col="sentWhen">Sent when</th>
              <th data-col="setting">Email setting</th>
              <th data-col="cta">Primary CTA link</th>
              <th data-col="preview">Preview</th>
            </tr>
          </thead>
          <tbody>
            ${[...previews.entries()].map(previewTableRow).join("")}
            <tr id="empty-row" hidden><td class="empty-cell" colspan="7">No emails match the current search or filters.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="footnote">Lifecycle sends additionally require an active account, verified consent, the relevant preference, no unsubscribe or suppression, treatment assignment, and the campaign’s local-time window.</p>
    </main>
    <script type="application/json" id="email-toolbar-config">${toolbarConfig}</script>
    <script src="/__email_preview_toolbar.js"></script>
  </body>
</html>`;
}

function mobilePreview(html) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mobile email preview</title><style>body{margin:0;background:#d9dde0;font-family:sans-serif}.device{width:390px;max-width:100%;height:100vh;margin:0 auto;background:#fff;box-shadow:0 0 30px rgba(0,0,0,.15)}iframe{width:100%;height:100%;border:0}</style></head><body><div class="device"><iframe title="390 pixel mobile email preview" srcdoc="${escapeHtml(html)}"></iframe></div></body></html>`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/__preview_version") {
    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(previewVersion);
    return;
  }
  if (url.pathname === "/__email_preview_toolbar.js") {
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(
      readFileSync(
        resolve(workspace, "supabase/scripts/email-preview-toolbar.js"),
        "utf8",
      ),
    );
    return;
  }
  if (url.pathname === "/__matt_signature") {
    response.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    });
    response.end(
      readFileSync(
        resolve(workspace, "assets/ucat-photos/signature/Signature.png"),
      ),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/ucat/email/")) {
    const filename = url.pathname.slice("/assets/ucat/email/".length);
    if (!filename.includes("/") && filename.endsWith(".jpg")) {
      const asset = resolve(
        workspace,
        "apps/marketing-web/public/assets/ucat/email",
        filename,
      );
      if (existsSync(asset)) {
        response.writeHead(200, {
          "Content-Type": "image/jpeg",
          "Cache-Control": "no-store",
        });
        response.end(readFileSync(asset));
        return;
      }
    }
  }
  if (url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(withLiveReload(gallery()));
    return;
  }
  if (url.pathname.startsWith("/preview/")) {
    const preview = previews.get(decodeURIComponent(url.pathname.slice("/preview/".length)));
    if (preview) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      const theme = url.searchParams.get("theme");
      const html = theme === "dark"
        ? forceDarkTheme(preview.html)
        : theme === "light"
        ? forceLightTheme(preview.html)
        : preview.html;
      response.end(withLiveReload(
        url.searchParams.get("viewport") === "mobile"
          ? mobilePreview(html)
          : html,
      ));
      return;
    }
  }
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Altitutor email previews: http://127.0.0.1:${port}`);
  console.log("Press Ctrl+C to stop.");
});
