import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const workspace = process.cwd();
const port = Number(process.env.UCAT_EMAIL_PREVIEW_PORT || 4187);

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
    return loadTypescriptModule(resolve(dirname(absolutePath), specifier));
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
          return name === "UCAT_WEB_URL" ? "https://ucat.altitutor.com" : undefined;
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

const candidate = {
  student_id: "preview-student",
  email: "student@example.com",
  first_name: "Alex",
  current_estimate: 2250,
  next_step_title: "a focused Quantitative Reasoning set",
  next_step_path: "/practice",
  questions_last_7_days: 86,
  sets_last_7_days: 4,
  mocks_last_7_days: 1,
  unsubscribe_token: "preview-token",
};

const lifecycleCampaigns = [
  ["onboarding_welcome", "Welcome"],
  ["onboarding_first_signal", "First score signal"],
  ["onboarding_plan", "Study plan setup"],
  ["onboarding_tracking", "Score tracking"],
  ["onboarding_free_forever", "Free forever"],
  ["inactive_7_days", "Seven-day return"],
  ["weekly_progress", "Weekly progress"],
];

const previews = new Map();
for (const [key, label] of lifecycleCampaigns) {
  const rendered = lifecycle.buildLifecycleEmail(candidate, {
    key,
    topic: "preview",
    dedupeKey: `preview:${key}`,
  });
  previews.set(`lifecycle-${key}`, {
    group: "Lifecycle",
    label,
    subject: rendered.subject,
    html: rendered.html,
  });
}

previews.set("transactional-access-ended", {
  group: "Billing & account",
  label: "Unlimited access ended",
  subject: "Your Altitutor UCAT Unlimited subscription has ended",
  html: transactional.renderUcatTransactionalEmail({
    previewText: "Your practice history is safe, and you can keep preparing on Free.",
    heading: "Your Unlimited access has ended",
    bodyHtml: `<p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">Hi Alex,</p><p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">We could not recover your subscription payment after several attempts, so your Altitutor UCAT Unlimited subscription has ended.</p><table role="presentation" width="100%" style="margin:24px 0;background:#eaf1f3;border:1px solid #d1e0e5;border-radius:12px"><tr><td style="padding:18px 20px;color:#0a2941;font-size:14px;line-height:1.65"><strong>Your account, practice history and results are safe.</strong> You can keep preparing on Free or restart Unlimited whenever you are ready.</td></tr></table>`,
  }),
});

previews.set("transactional-trial-ending", {
  group: "Billing & account",
  label: "Trial ending soon",
  subject: "Your Altitutor UCAT Unlimited trial ends on 16 August 2026",
  html: transactional.renderUcatTransactionalEmail({
    previewText:
      "Your Unlimited trial ends on 16 August. Review your estimated first payment.",
    heading: "Your Unlimited trial ends soon",
    bodyHtml:
      `<p style="margin:0 0 16px;color:#394650;font-size:15px;line-height:1.7">Hi Alex,</p><p style="margin:0;color:#394650;font-size:15px;line-height:1.7">Your Altitutor UCAT Unlimited trial ends on <strong class="email-strong" style="color:#0a2941">16 August 2026</strong>. Your subscription will begin after the trial unless you cancel.</p>${transactional.renderUcatEmailPanel("<strong class=\"email-strong\" style=\"color:#0a2941\">Current estimated first payment: $39.00</strong><br>Your final payment may be lower if you earn more practice-day discounts before billing.")}${transactional.renderUcatEmailButton("https://ucat.altitutor.com/settings/plan/subscription?utm_source=altitutor&utm_medium=email&utm_campaign=ucat_trial_ending", "Review subscription")}`,
  }),
});

const transactionalTemplates = [
  ["public_interest_supported_access_received", "Supported access received"],
  ["public_interest_online_tutoring_waitlist_received", "Tutoring waitlist received"],
  ["referral_gift_received", "Friend received a gift"],
  ["referral_access_gift_earned", "Free access reward earned"],
  ["referral_billing_credit_earned", "Annual credit earned"],
  ["referral_free_bill_earned", "Free bill earned"],
  ["subscription_activated", "Unlimited activated"],
  ["subscription_cancellation_scheduled", "Cancellation scheduled"],
  ["subscription_cancellation_reversed", "Cancellation reversed"],
  ["subscription_canceled", "Moved to Free"],
];

for (const [templateKey, label] of transactionalTemplates) {
  const rendered = transactionalDispatch.renderTransactionalEmail({
    id: `preview-${templateKey}`,
    student_id: "preview-student",
    recipient_email: "student@example.com",
    template_key: templateKey,
    event_key: `preview:${templateKey}`,
    attempt_count: 1,
    payload: {
      first_name: "Alex",
      referrer_name: "Brian",
      duration_interval: "month",
      expires_at: "2026-08-16T00:00:00+09:30",
      amount_off_cents: 4900,
      trial_end: "2026-08-16T00:00:00+09:30",
      cancel_at: "2026-08-30T00:00:00+09:30",
      action_path: "/settings/plan/subscription",
    },
  });
  previews.set(`transactional-${templateKey}`, {
    group: templateKey.startsWith("referral_") ? "Referrals" : "Billing & account",
    label,
    subject: rendered.subject,
    html: rendered.html,
  });
}

const authTemplates = [
  ["confirmation", "Confirm signup"],
  ["recovery", "Reset password"],
  ["magic_link", "Magic link"],
  ["invite", "Invitation"],
  ["email_change", "Confirm email change"],
  ["reauthentication", "Reauthentication"],
];

for (const [file, label] of authTemplates) {
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
    group: "Account access",
    label,
    subject: label,
    html: source,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function forceDarkTheme(html) {
  const css = `<style id="preview-dark-theme">
    body,.email-page,.email-bg{background-color:#071923!important}
    .email-card,.email-content{background-color:#102630!important;border-color:#35505b!important}
    .email-heading,.email-title,.email-strong{color:#f2f0e9!important}
    .email-copy,.email-copy p,.email-copy li{color:#d7e1e4!important}
    .email-panel,.email-footer{background-color:#17333e!important;border-color:#35505b!important}
    .email-module-surface{background-color:#102630!important;border-color:#35505b!important}
    .email-panel-copy,.email-panel-copy p,.email-panel-copy td,.email-footer p,.email-footer a{color:#d7e1e4!important}
    .email-muted{color:#aebdc3!important}.email-link,.email-footer-title{color:#c9e2ea!important}
    .email-button-cell,.email-button{background-color:#63c9a8!important}.email-button{color:#071923!important}
  </style>`;
  return html.includes("</head>")
    ? html.replace("</head>", `${css}</head>`)
    : `${css}${html}`;
}

function gallery() {
  const groups = Map.groupBy([...previews.entries()], ([, preview]) => preview.group);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Altitutor UCAT email previews</title><style>body{margin:0;background:#f2f0e9;color:#1a1a1a;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:980px;margin:auto;padding:56px 24px}h1{margin:0;color:#0a2941;font-size:36px;letter-spacing:-1px}p{color:#52606a}.group{margin-top:42px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.card{display:block;border:1px solid #d5dee1;border-radius:14px;background:white;padding:20px;color:inherit;text-decoration:none;box-shadow:0 7px 24px rgba(10,41,65,.05)}.card:hover{border-color:#92b9c6;transform:translateY(-1px)}.tag{font:11px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.12em;color:#527487}.subject{margin-top:9px;font-weight:700;color:#0a2941}.links{display:flex;gap:12px;margin-top:12px}.links a{font-size:12px;color:#0a2941}</style></head><body><main><p class="tag">Local review tool</p><h1>Altitutor UCAT emails</h1><p>These previews render from the same lifecycle, transactional and authentication templates used by the product. No email is sent.</p>${[...groups.entries()].map(([group, items]) => `<section class="group"><h2>${escapeHtml(group)}</h2><div class="grid">${items.map(([key, item]) => `<article class="card"><span class="tag">${escapeHtml(item.label)}</span><div class="subject">${escapeHtml(item.subject)}</div><div class="links"><a href="/preview/${encodeURIComponent(key)}" target="_blank">Light</a><a href="/preview/${encodeURIComponent(key)}?theme=dark" target="_blank">Dark emulation</a></div></article>`).join("")}</div></section>`).join("")}</main></body></html>`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(gallery());
    return;
  }
  if (url.pathname.startsWith("/preview/")) {
    const preview = previews.get(decodeURIComponent(url.pathname.slice("/preview/".length)));
    if (preview) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(
        url.searchParams.get("theme") === "dark"
          ? forceDarkTheme(preview.html)
          : preview.html,
      );
      return;
    }
  }
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Altitutor UCAT email previews: http://127.0.0.1:${port}`);
  console.log("Press Ctrl+C to stop.");
});
