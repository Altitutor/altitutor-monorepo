export type EmailBrand = "altitutor" | "ucat";

export type EmailSender = "altitutor" | "ucat-product" | "founder";

export type RenderedEmail = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
  from: string;
  replyTo: string;
};

export const EMAIL_SENDERS = {
  altitutor: {
    from: "Altitutor <admin@altitutor.com>",
    replyTo: "admin@altitutor.com",
  },
  "ucat-product": {
    from: "Altitutor UCAT <admin@altitutor.com>",
    replyTo: "admin@altitutor.com",
  },
  founder: {
    from: "Matt at Altitutor <matt@altitutor.com>",
    replyTo: "matt@altitutor.com",
  },
} as const;

export type EmailBrandContact = {
  email: string;
  websiteLabel: string;
  websiteUrl: string;
  phone?: string;
  phoneHref?: string;
  address?: string;
};

/** Public Altitutor contact details (same values as student-web). */
export const COMPANY_CONTACT = {
  email: "admin@altitutor.com",
  phone: "+61 483 849 842",
  phoneHref: "+61483849842",
  address: "Level 1, 17A Solomon St, Adelaide SA 5000",
  websiteLabel: "altitutor.com",
  websiteUrl: "https://altitutor.com",
} as const satisfies EmailBrandContact;

const EMAIL_BRANDS: Record<
  EmailBrand,
  {
    name: string;
    subtitle: string | null;
    footerTagline: string | null;
    contact: EmailBrandContact;
  }
> = {
  altitutor: {
    name: "Altitutor",
    subtitle: null,
    footerTagline: null,
    contact: COMPANY_CONTACT,
  },
  ucat: {
    name: "Altitutor UCAT",
    subtitle: "UCAT preparation from Altitutor",
    footerTagline: "A not-for-profit initiative by Altitutor.",
    contact: {
      email: COMPANY_CONTACT.email,
      websiteLabel: "altitutor.com/ucat",
      websiteUrl: "https://altitutor.com/ucat",
    },
  },
};

function renderBrandFooterHtml(brand: (typeof EMAIL_BRANDS)[EmailBrand]): string {
  const title = `<p class="email-accent" style="margin:0 0 ${
    brand.footerTagline ? "3px" : "8px"
  };color:#0a2941;font-size:13px;font-weight:700;line-height:1.5">${escapeEmailHtml(brand.name)}</p>`;
  if (!brand.footerTagline) return title;
  return `${title}
            <p style="margin:0 0 10px;color:#52606a;font-size:12px;line-height:1.5">${escapeEmailHtml(brand.footerTagline)}</p>`;
}

function renderContactFooterHtml(contact: EmailBrandContact): string {
  const mutedLine = "margin:0;color:#52606a;font-size:12px;line-height:1.6";
  const lines: string[] = [];

  if (contact.address) {
    lines.push(
      `<p style="${mutedLine}">${escapeEmailHtml(contact.address)}</p>`,
    );
  }

  const detailLines: string[] = [];
  if (contact.phone && contact.phoneHref) {
    detailLines.push(
      `Phone: <a class="email-link" href="tel:${escapeEmailHtml(contact.phoneHref)}" style="color:#0a2941">${escapeEmailHtml(contact.phone)}</a>`,
    );
  }
  detailLines.push(
    `Email: <a class="email-link" href="mailto:${escapeEmailHtml(contact.email)}" style="color:#0a2941">${escapeEmailHtml(contact.email)}</a>`,
  );
  detailLines.push(
    `Web: <a class="email-link" href="${escapeEmailHtml(contact.websiteUrl)}" style="color:#0a2941">${escapeEmailHtml(contact.websiteLabel)}</a>`,
  );

  for (const [index, detail] of detailLines.entries()) {
    const style =
      index === 0 && contact.address
        ? "margin:12px 0 0;color:#52606a;font-size:12px;line-height:1.6"
        : mutedLine;
    lines.push(`<p style="${style}">${detail}</p>`);
  }

  return lines.join("\n            ");
}

export function escapeEmailHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderEmailButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0">
    <tr>
      <td class="email-button-cell" bgcolor="#0a2941" style="border-radius:10px;background-color:#0a2941">
        <a class="email-button" href="${escapeEmailHtml(href)}" style="display:inline-block;min-width:176px;padding:14px 22px;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;line-height:1.4;text-align:center;text-decoration:none">${escapeEmailHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export function renderEmailPanel(
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

export function renderEmail(input: {
  brand: EmailBrand;
  subject: string;
  previewText: string;
  heading: string;
  bodyHtml: string;
  bodyText: string;
  sender?: EmailSender;
  /** Optional marketing actions (preferences / unsubscribe). Rendered after contact. */
  marketingFooterHtml?: string;
  year?: number | string;
}): RenderedEmail {
  const brand = EMAIL_BRANDS[input.brand];
  const sender = EMAIL_SENDERS[
    input.sender ?? (input.brand === "ucat" ? "ucat-product" : "altitutor")
  ];
  const year = input.year ?? new Date().getUTCFullYear();
  const subtitle = brand.subtitle
    ? `<p class="email-brand-subtitle" style="margin:6px 0 0;color:#b9d1d9;font-size:13px;line-height:1.5">${escapeEmailHtml(brand.subtitle)}</p>`
    : "";
  const brandFooterHtml = renderBrandFooterHtml(brand);
  const contactFooterHtml = renderContactFooterHtml(brand.contact);

  return {
    subject: input.subject,
    previewText: input.previewText,
    text: `${input.heading}\n\n${input.bodyText}`,
    from: sender.from,
    replyTo: sender.replyTo,
    html: `<!doctype html>
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
        a, a.email-link, .email-brand, .email-link, .email-accent,
        .email-content a, .email-copy a, .email-muted a, .email-panel a,
        .email-panel-copy .email-accent, .email-panel .email-accent { color: #b7d4df !important; }
        .email-brand-subtitle, .email-muted, .email-panel .email-muted { color: #b3b3b3 !important; }
        .email-heading, .email-strong, .email-panel .email-strong { color: #ffffff !important; }
        .email-copy, .email-copy p, .email-copy li, .email-copy td { color: #f5f5f5 !important; }
        .email-panel { background-color: #262626 !important; border-color: #2b2b2b !important; }
        .email-panel td, .email-panel-copy, .email-panel-copy p, .email-panel-copy td { color: #f5f5f5 !important; }
        .email-module-surface { background-color: #2b2b2b !important; border-color: #2b2b2b !important; }
        .email-footer { background-color: #262626 !important; border-color: #2b2b2b !important; }
        .email-footer p { color: #b3b3b3 !important; }
        .email-footer a { color: #b7d4df !important; }
        .email-button-cell { background-color: #92b5c3 !important; }
        a.email-button, .email-button, .email-content a.email-button,
        .email-copy a.email-button, .email-button-cell a { color: #1c1c1c !important; }
        .email-accent-fill { background-color: #92b5c3 !important; color:#1c1c1c !important; }
      }
      [data-ogsc] body, [data-ogsc] .email-page { background-color: #171717 !important; }
      [data-ogsc] .email-card, [data-ogsc] .email-content, [data-ogsc] .email-header { background-color: #1f1f1f !important; }
      [data-ogsc] .email-card, [data-ogsc] .email-header { border-color: #2b2b2b !important; }
      [data-ogsc] a, [data-ogsc] a.email-link, [data-ogsc] .email-brand, [data-ogsc] .email-link,
      [data-ogsc] .email-accent, [data-ogsc] .email-content a, [data-ogsc] .email-copy a,
      [data-ogsc] .email-muted a, [data-ogsc] .email-panel a, [data-ogsc] .email-panel-copy .email-accent,
      [data-ogsc] .email-panel .email-accent { color: #b7d4df !important; }
      [data-ogsc] .email-brand-subtitle, [data-ogsc] .email-muted,
      [data-ogsc] .email-panel .email-muted { color: #b3b3b3 !important; }
      [data-ogsc] .email-heading, [data-ogsc] .email-strong,
      [data-ogsc] .email-panel .email-strong { color: #ffffff !important; }
      [data-ogsc] .email-copy, [data-ogsc] .email-copy p, [data-ogsc] .email-copy li,
      [data-ogsc] .email-copy td { color: #f5f5f5 !important; }
      [data-ogsc] .email-panel { background-color: #262626 !important; border-color: #2b2b2b !important; }
      [data-ogsc] .email-panel td, [data-ogsc] .email-panel-copy, [data-ogsc] .email-panel-copy p,
      [data-ogsc] .email-panel-copy td { color: #f5f5f5 !important; }
      [data-ogsc] .email-module-surface { background-color: #2b2b2b !important; border-color: #2b2b2b !important; }
      [data-ogsc] .email-footer { background-color: #262626 !important; border-color: #2b2b2b !important; }
      [data-ogsc] .email-footer p { color: #b3b3b3 !important; }
      [data-ogsc] .email-footer a { color: #b7d4df !important; }
      [data-ogsc] .email-button-cell { background-color: #92b5c3 !important; }
      [data-ogsc] a.email-button, [data-ogsc] .email-button, [data-ogsc] .email-content a.email-button,
      [data-ogsc] .email-copy a.email-button, [data-ogsc] .email-button-cell a { color: #1c1c1c !important; }
      [data-ogsb] .email-accent-fill { background-color: #92b5c3 !important; }
      [data-ogsc] .email-accent-fill { color: #1c1c1c !important; }
    </style>
    <!--[if mso]><style type="text/css">body, table, td, a { font-family: Arial, sans-serif !important; }</style><![endif]-->
  </head>
  <body style="margin:0;padding:0;background-color:#f2f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(input.previewText)}</div>
    <table class="email-page" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#f2f0e9" style="width:100%;background-color:#f2f0e9">
      <tr><td class="email-page-pad" align="center" style="padding:32px 16px">
        <table class="email-card" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dce5e8;border-radius:16px;overflow:hidden">
          <tr><td class="email-header" bgcolor="#0a2941" style="padding:30px 36px;background-color:#0a2941;border-bottom:1px solid #0a2941">
            <p class="email-brand" style="margin:0;color:#f2f0e9;font-size:24px;font-weight:700;letter-spacing:-0.4px">${escapeEmailHtml(brand.name)}</p>${subtitle ? `
            ${subtitle}` : ""}
          </td></tr>
          <tr><td class="email-content email-copy" bgcolor="#ffffff" style="padding:36px;background-color:#ffffff;color:#394650">
            <h1 class="email-heading" style="margin:0 0 18px;color:#0a2941;font-size:26px;font-weight:700;line-height:1.25">${escapeEmailHtml(input.heading)}</h1>
            ${input.bodyHtml}
          </td></tr>
          <tr><td class="email-footer" bgcolor="#eaf1f3" style="padding:24px 36px;background-color:#eaf1f3;border-top:1px solid #dce5e8">
            ${brandFooterHtml}
            ${contactFooterHtml}${input.marketingFooterHtml ? `
            ${input.marketingFooterHtml}` : ""}
            <p style="margin:12px 0 0;color:#73808a;font-size:11px;line-height:1.5">&copy; ${year} Altitutor.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
