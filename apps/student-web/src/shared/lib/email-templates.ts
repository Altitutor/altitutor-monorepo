function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function emailShell({
  title,
  greeting,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  greeting: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const ctaSection =
    ctaLabel && ctaUrl
      ? `
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0;">
                    <tr>
                      <td align="center">
                        <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; padding: 14px 32px; background-color: #0a2941; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; line-height: 1.5; text-align: center;">
                          ${escapeHtml(ctaLabel)}
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    If the button doesn't work, copy and paste this link into your browser:
                  </p>
                  <p style="margin: 8px 0 0; color: #92b9c6; font-size: 14px; line-height: 1.6; word-break: break-all;">
                    <a href="${escapeHtml(ctaUrl)}" style="color: #92b9c6; text-decoration: underline;">${escapeHtml(ctaUrl)}</a>
                  </p>`
      : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #0a2941 0%, #144e72 100%); border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; text-align: center;">Altitutor</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #0a2941; font-size: 24px; font-weight: 600; line-height: 1.3;">${escapeHtml(title)}</h2>
                  <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">${escapeHtml(greeting)}</p>
                  ${bodyHtml}
                  ${ctaSection}
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                    This email was sent by Altitutor.
                  </p>
                  <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">
                    © ${new Date().getFullYear()} Altitutor. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function getBookingChangedEmailTemplate({
  firstName,
  lastName,
  sessionDate,
  sessionTime,
  bookingUrl,
}: {
  firstName: string;
  lastName: string;
  sessionDate: string;
  sessionTime: string;
  bookingUrl: string;
}): string {
  return emailShell({
    title: 'Your session has been changed',
    greeting: `Hello ${firstName} ${lastName},`,
    bodyHtml: `
      <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
        Your booking has been updated to <strong>${escapeHtml(sessionDate)}</strong> at <strong>${escapeHtml(sessionTime)}</strong>.
      </p>
      <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
        Click the button below to view your updated booking confirmation.
      </p>
    `,
    ctaLabel: 'View Booking Confirmation',
    ctaUrl: bookingUrl,
  });
}

export function getBookingCancelledEmailTemplate({
  firstName,
  lastName,
  sessionDate,
  sessionTime,
}: {
  firstName: string;
  lastName: string;
  sessionDate: string;
  sessionTime: string;
}): string {
  return emailShell({
    title: 'Your session has been cancelled',
    greeting: `Hello ${firstName} ${lastName},`,
    bodyHtml: `
      <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
        Your booking on <strong>${escapeHtml(sessionDate)}</strong> at <strong>${escapeHtml(sessionTime)}</strong> has been cancelled.
      </p>
      <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
        If this was a mistake or you would like to book again, please contact Altitutor.
      </p>
    `,
  });
}
