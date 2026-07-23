export const UCAT_TRANSACTIONAL_FROM = "Altitutor UCAT <noreply@altitutor.com>";
export const UCAT_TRANSACTIONAL_REPLY_TO = "admin@altitutor.com";

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderUcatTransactionalEmail(input: {
  previewText: string;
  heading: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${escapeEmailHtml(input.heading)}</title>
    <!--[if mso]><style type="text/css">body, table, td, a { font-family: Arial, sans-serif !important; }</style><![endif]-->
  </head>
  <body style="margin:0;padding:0;background-color:#f2f0e9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(input.previewText)}</div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;background-color:#f2f0e9">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dce5e8;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:30px 36px;background-color:#0a2941">
                <p style="margin:0;color:#f2f0e9;font-size:24px;font-weight:700;letter-spacing:-0.4px">Altitutor UCAT</p>
                <p style="margin:6px 0 0;color:#b9d1d9;font-size:13px;line-height:1.5">UCAT preparation from Altitutor</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px">
                <h1 style="margin:0 0 18px;color:#0a2941;font-size:26px;font-weight:700;line-height:1.25">${escapeEmailHtml(input.heading)}</h1>
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 36px;background-color:#eaf1f3;border-top:1px solid #dce5e8">
                <p style="margin:0 0 8px;color:#0a2941;font-size:13px;font-weight:600;line-height:1.5">A not-for-profit initiative by Altitutor.</p>
                <p style="margin:0;color:#52606a;font-size:12px;line-height:1.6">Need help? Reply to this email or contact <a href="mailto:${UCAT_TRANSACTIONAL_REPLY_TO}" style="color:#0a2941">${UCAT_TRANSACTIONAL_REPLY_TO}</a>.</p>
                <p style="margin:12px 0 0;color:#73808a;font-size:11px;line-height:1.5">&copy; ${new Date().getUTCFullYear()} Altitutor.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
