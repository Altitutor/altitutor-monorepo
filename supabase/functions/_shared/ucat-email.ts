export const UCAT_APP_URL = (
  Deno.env.get("UCAT_WEB_URL") || "https://ucat.altitutor.com"
).replace(/\/$/, "");

export const UCAT_EMAIL_SENDERS = {
  founder: {
    from: "Matt at Altitutor <matt@altitutor.com>",
    replyTo: "matt@altitutor.com",
  },
  product: {
    from: "Altitutor UCAT <admin@altitutor.com>",
    replyTo: "admin@altitutor.com",
  },
  formal: {
    from: "Altitutor <admin@altitutor.com>",
    replyTo: "admin@altitutor.com",
  },
} as const;

export type UcatEmailSender = keyof typeof UCAT_EMAIL_SENDERS;

export function escapeEmailHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildUcatEmailActionUrl(input: {
  path: string;
  campaign: string;
  content?: string;
}): string {
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const url = new URL(path, `${UCAT_APP_URL}/`);
  url.searchParams.set("utm_source", "altitutor");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", input.campaign);
  if (input.content) url.searchParams.set("utm_content", input.content);
  return url.toString();
}

export function renderUcatEmailButton(
  href: string,
  label: string,
): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0">
    <tr>
      <td class="email-button-cell" bgcolor="#0a2941" style="border-radius:10px;background-color:#0a2941">
        <a class="email-button" href="${
    escapeEmailHtml(href)
  }" style="display:inline-block;min-width:176px;padding:14px 22px;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;line-height:1.4;text-align:center;text-decoration:none">${
    escapeEmailHtml(label)
  }</a>
      </td>
    </tr>
  </table>`;
}

export function renderUcatEmailPanel(
  bodyHtml: string,
  tone: "blue" | "cream" = "blue",
): string {
  const background = tone === "cream" ? "#f7f2e8" : "#eaf1f3";
  const border = tone === "cream" ? "#e8dcc8" : "#d1e0e5";
  return `<table class="email-panel" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${background}" style="margin:22px 0;background-color:${background};border:1px solid ${border};border-radius:12px">
    <tr>
      <td class="email-panel-copy" style="padding:18px 20px;color:#223b4b;font-size:14px;line-height:1.65">${bodyHtml}</td>
    </tr>
  </table>`;
}

export function renderUcatEmail(input: {
  previewText: string;
  heading: string;
  bodyHtml: string;
  footerHtml?: string;
  marketingFooterHtml?: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeEmailHtml(input.heading)}</title>
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      a { color: #0a2941; }
      @media only screen and (max-width: 620px) {
        .email-page-pad { padding: 18px 10px !important; }
        .email-header, .email-content, .email-footer { padding-left: 22px !important; padding-right: 22px !important; }
        .email-heading { font-size: 23px !important; }
        .email-button { display: block !important; min-width: 0 !important; }
      }
      @media (prefers-color-scheme: dark) {
        body, .email-page { background-color: #171717 !important; }
        .email-card, .email-content, .email-header { background-color: #1f1f1f !important; }
        .email-card, .email-header { border-color: #2b2b2b !important; }
        a, .email-brand, .email-link, .email-accent,
        .email-panel-copy .email-accent { color: #92b5c3 !important; }
        .email-brand-subtitle, .email-muted { color: #b3b3b3 !important; }
        .email-heading, .email-strong { color: #ffffff !important; }
        .email-copy, .email-copy p, .email-copy li { color: #f5f5f5 !important; }
        .email-panel { background-color: #262626 !important; border-color: #2b2b2b !important; }
        .email-panel-copy, .email-panel-copy p, .email-panel-copy td { color: #f5f5f5 !important; }
        .email-module-surface { background-color: #2b2b2b !important; border-color: #2b2b2b !important; }
        .email-footer { background-color: #262626 !important; border-color: #2b2b2b !important; }
        .email-footer p { color: #b3b3b3 !important; }
        .email-footer a { color: #92b5c3 !important; }
        .email-button-cell { background-color: #92b5c3 !important; }
        .email-button { color: #1c1c1c !important; }
        .email-accent-fill {
          background-color: #92b5c3 !important;
          color: #1c1c1c !important;
        }
      }
      [data-ogsc] body, [data-ogsc] .email-page { background-color: #171717 !important; }
      [data-ogsc] .email-card, [data-ogsc] .email-content, [data-ogsc] .email-header { background-color: #1f1f1f !important; }
      [data-ogsc] .email-card, [data-ogsc] .email-header { border-color: #2b2b2b !important; }
      [data-ogsc] a, [data-ogsc] .email-brand, [data-ogsc] .email-link,
      [data-ogsc] .email-accent,
      [data-ogsc] .email-panel-copy .email-accent { color: #92b5c3 !important; }
      [data-ogsc] .email-brand-subtitle, [data-ogsc] .email-muted { color: #b3b3b3 !important; }
      [data-ogsc] .email-heading, [data-ogsc] .email-strong { color: #ffffff !important; }
      [data-ogsc] .email-copy, [data-ogsc] .email-copy p, [data-ogsc] .email-copy li { color: #f5f5f5 !important; }
      [data-ogsc] .email-panel { background-color: #262626 !important; border-color: #2b2b2b !important; }
      [data-ogsc] .email-panel-copy, [data-ogsc] .email-panel-copy p, [data-ogsc] .email-panel-copy td { color: #f5f5f5 !important; }
      [data-ogsc] .email-module-surface { background-color: #2b2b2b !important; border-color: #2b2b2b !important; }
      [data-ogsc] .email-footer { background-color: #262626 !important; border-color: #2b2b2b !important; }
      [data-ogsc] .email-footer p { color: #b3b3b3 !important; }
      [data-ogsc] .email-footer a { color: #92b5c3 !important; }
      [data-ogsc] .email-button-cell { background-color: #92b5c3 !important; }
      [data-ogsc] .email-button { color: #1c1c1c !important; }
      [data-ogsb] .email-accent-fill { background-color: #92b5c3 !important; }
      [data-ogsc] .email-accent-fill { color: #1c1c1c !important; }
    </style>
    <!--[if mso]><style type="text/css">body, table, td, a { font-family: Arial, sans-serif !important; }</style><![endif]-->
  </head>
  <body style="margin:0;padding:0;background-color:#f2f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${
    escapeEmailHtml(input.previewText)
  }</div>
    <table class="email-page" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#f2f0e9" style="width:100%;background-color:#f2f0e9">
      <tr>
        <td class="email-page-pad" align="center" style="padding:32px 16px">
          <table class="email-card" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dce5e8;border-radius:16px;overflow:hidden">
            <tr>
              <td class="email-header" bgcolor="#0a2941" style="padding:30px 36px;background-color:#0a2941;border-bottom:1px solid #0a2941">
                <p class="email-brand" style="margin:0;color:#f2f0e9;font-size:24px;font-weight:700;letter-spacing:-0.4px">Altitutor UCAT</p>
                <p class="email-brand-subtitle" style="margin:6px 0 0;color:#b9d1d9;font-size:13px;line-height:1.5">UCAT preparation from Altitutor</p>
              </td>
            </tr>
            <tr>
              <td class="email-content email-copy" bgcolor="#ffffff" style="padding:36px;background-color:#ffffff;color:#394650">
                <h1 class="email-heading" style="margin:0 0 18px;color:#0a2941;font-size:26px;font-weight:700;line-height:1.25">${
    escapeEmailHtml(input.heading)
  }</h1>
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td class="email-footer" bgcolor="#eaf1f3" style="padding:24px 36px;background-color:#eaf1f3;border-top:1px solid #dce5e8">
                <p class="email-accent" style="margin:0 0 8px;color:#0a2941;font-size:13px;font-weight:600;line-height:1.5">A not-for-profit initiative by Altitutor.</p>
                ${
    input.footerHtml ??
      '<p style="margin:0;color:#52606a;font-size:12px;line-height:1.6">Need help? Reply to this email or contact <a class="email-link" href="mailto:admin@altitutor.com" style="color:#0a2941">admin@altitutor.com</a>.</p>'
  }
                ${input.marketingFooterHtml ?? ""}
                <p style="margin:12px 0 0;color:#73808a;font-size:11px;line-height:1.5">&copy; ${
    new Date().getUTCFullYear()
  } Altitutor.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
