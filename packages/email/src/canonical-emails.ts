import {
  escapeEmailHtml,
  EMAIL_SENDERS,
  renderEmail,
  renderEmailButton,
  type RenderedEmail,
} from "./render-email";

const paragraphStyle =
  "margin:0 0 18px;color:#394650;font-size:15px;line-height:1.7";
const mutedStyle =
  "margin:0;color:#68757e;font-size:13px;line-height:1.6";

function textWithBreaks(value: string): string {
  return escapeEmailHtml(value).replaceAll("\n", "<br />");
}

function actionFallback(url: string): string {
  const safeUrl = escapeEmailHtml(url);
  return `<p class="email-muted" style="${mutedStyle}">If the button does not work, copy this link into your browser:<br /><a class="email-link" href="${safeUrl}" style="color:#0a2941;word-break:break-all">${safeUrl}</a></p>`;
}

export function buildInvitationEmail(input: {
  recipientName: string;
  inviteUrl: string;
  staffIntroduction?: string;
  expiresIn?: string;
}): RenderedEmail {
  const heading = "Create your Altitutor account";
  const expiry = input.expiresIn ?? "1 hour";
  const introductionHtml = input.staffIntroduction
    ? `<p class="email-copy" style="${paragraphStyle}">${textWithBreaks(input.staffIntroduction)}</p>`
    : "";
  const introductionText = input.staffIntroduction
    ? `${input.staffIntroduction}\n\n`
    : "";
  const bodyText = `Hello ${input.recipientName},\n\n${introductionText}You’ve been invited to create your Altitutor account.\n\nCreate account: ${input.inviteUrl}\n\nThis invitation link expires in ${expiry}. If you did not expect this invitation, you can safely ignore this email.`;

  return renderEmail({
    brand: "altitutor",
    subject: "You’ve been invited to Altitutor",
    previewText: "Create your Altitutor account using your secure invitation.",
    heading,
    bodyText,
    bodyHtml: `
      <p class="email-copy" style="${paragraphStyle}">Hello ${escapeEmailHtml(input.recipientName)},</p>
      ${introductionHtml}
      <p class="email-copy" style="${paragraphStyle}">You’ve been invited to create your Altitutor account. Use the secure invitation below to get started.</p>
      ${renderEmailButton(input.inviteUrl, "Create account")}
      ${actionFallback(input.inviteUrl)}
      <p class="email-muted" style="margin:18px 0 0;color:#68757e;font-size:13px;line-height:1.6">This invitation link expires in ${escapeEmailHtml(expiry)}. If you did not expect this invitation, you can safely ignore this email.</p>
    `,
  });
}

export function buildRegistrationEmail(input: {
  recipientName: string;
  studentName: string;
  registrationUrl: string;
  staffIntroduction?: string;
}): RenderedEmail {
  const heading = `Complete registration for ${input.studentName}`;
  const introductionHtml = input.staffIntroduction
    ? `<p class="email-copy" style="${paragraphStyle}">${textWithBreaks(input.staffIntroduction)}</p>`
    : "";
  const introductionText = input.staffIntroduction
    ? `${input.staffIntroduction}\n\n`
    : "";
  const bodyText = `Hello ${input.recipientName},\n\n${introductionText}Please complete ${input.studentName}’s student registration.\n\nComplete registration: ${input.registrationUrl}\n\nIf you did not expect this email, you can safely ignore it.`;

  return renderEmail({
    brand: "altitutor",
    subject: `Complete registration for ${input.studentName} — Altitutor`,
    previewText: `Complete ${input.studentName}’s Altitutor registration.`,
    heading,
    bodyText,
    bodyHtml: `
      <p class="email-copy" style="${paragraphStyle}">Hello ${escapeEmailHtml(input.recipientName)},</p>
      ${introductionHtml}
      <p class="email-copy" style="${paragraphStyle}">Please complete ${escapeEmailHtml(input.studentName)}’s student registration using the secure link below.</p>
      ${renderEmailButton(input.registrationUrl, "Complete registration")}
      ${actionFallback(input.registrationUrl)}
      <p class="email-muted" style="margin:18px 0 0;color:#68757e;font-size:13px;line-height:1.6">If you did not expect this email, you can safely ignore it.</p>
    `,
  });
}

export function buildBookingConfirmationEmail(input: {
  recipientName: string;
  studentName: string;
  bookingUrl: string;
  sessionDate?: string;
  sessionTime?: string;
  staffIntroduction?: string;
}): RenderedEmail {
  const heading = "Your booking confirmation";
  const when =
    input.sessionDate && input.sessionTime
      ? ` for ${input.sessionDate} at ${input.sessionTime}`
      : "";
  const introductionHtml = input.staffIntroduction
    ? `<p class="email-copy" style="${paragraphStyle}">${textWithBreaks(input.staffIntroduction)}</p>`
    : "";
  const introductionText = input.staffIntroduction
    ? `${input.staffIntroduction}\n\n`
    : "";
  const bodyText = `Hello ${input.recipientName},\n\n${introductionText}Your booking confirmation${when} is ready.\n\nView booking confirmation: ${input.bookingUrl}`;

  return renderEmail({
    brand: "altitutor",
    subject: `Booking confirmation for ${input.studentName} — Altitutor`,
    previewText: `View ${input.studentName}’s Altitutor booking confirmation.`,
    heading,
    bodyText,
    bodyHtml: `
      <p class="email-copy" style="${paragraphStyle}">Hello ${escapeEmailHtml(input.recipientName)},</p>
      ${introductionHtml}
      <p class="email-copy" style="${paragraphStyle}">Your booking confirmation${escapeEmailHtml(when)} is ready.</p>
      ${renderEmailButton(input.bookingUrl, "View booking confirmation")}
      ${actionFallback(input.bookingUrl)}
    `,
  });
}

type BookingChangeInput = {
  recipientName: string;
  sessionDate: string;
  sessionTime: string;
};

export function buildBookingChangedEmail(
  input: BookingChangeInput & { bookingUrl: string },
): RenderedEmail {
  const heading = "Your session has changed";
  const bodyText = `Hello ${input.recipientName},\n\nYour booking has been updated to ${input.sessionDate} at ${input.sessionTime}.\n\nView updated booking: ${input.bookingUrl}`;
  return renderEmail({
    brand: "altitutor",
    subject: "Your Altitutor session has changed",
    previewText: `Your session is now ${input.sessionDate} at ${input.sessionTime}.`,
    heading,
    bodyText,
    bodyHtml: `
      <p class="email-copy" style="${paragraphStyle}">Hello ${escapeEmailHtml(input.recipientName)},</p>
      <p class="email-copy" style="${paragraphStyle}">Your booking has been updated to <strong class="email-strong" style="color:#0a2941">${escapeEmailHtml(input.sessionDate)}</strong> at <strong class="email-strong" style="color:#0a2941">${escapeEmailHtml(input.sessionTime)}</strong>.</p>
      ${renderEmailButton(input.bookingUrl, "View updated booking")}
      ${actionFallback(input.bookingUrl)}
    `,
  });
}

export function buildBookingCancelledEmail(
  input: BookingChangeInput,
): RenderedEmail {
  const heading = "Your session has been cancelled";
  const bodyText = `Hello ${input.recipientName},\n\nYour booking on ${input.sessionDate} at ${input.sessionTime} has been cancelled.\n\nIf this was a mistake or you would like to book again, reply to this email.`;
  return renderEmail({
    brand: "altitutor",
    subject: "Your Altitutor session has been cancelled",
    previewText: `Your session on ${input.sessionDate} has been cancelled.`,
    heading,
    bodyText,
    bodyHtml: `
      <p class="email-copy" style="${paragraphStyle}">Hello ${escapeEmailHtml(input.recipientName)},</p>
      <p class="email-copy" style="${paragraphStyle}">Your booking on <strong class="email-strong" style="color:#0a2941">${escapeEmailHtml(input.sessionDate)}</strong> at <strong class="email-strong" style="color:#0a2941">${escapeEmailHtml(input.sessionTime)}</strong> has been cancelled.</p>
      <p class="email-copy" style="${paragraphStyle}">If this was a mistake or you would like to book again, reply to this email.</p>
    `,
  });
}

export function buildInvoiceNotificationEmail(input: {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
}): RenderedEmail {
  const heading = `Invoice ${input.invoiceNumber} is ready`;
  const hostedAction = input.hostedInvoiceUrl
    ? renderEmailButton(input.hostedInvoiceUrl, "View and pay invoice") +
      actionFallback(input.hostedInvoiceUrl)
    : "";
  const pdfAction = input.invoicePdfUrl
    ? `<p style="margin:18px 0 0;color:#394650;font-size:14px;line-height:1.6"><a class="email-link" href="${escapeEmailHtml(input.invoicePdfUrl)}" style="color:#0a2941;font-weight:600">Download invoice PDF</a></p>`
    : "";
  const textActions = [
    input.hostedInvoiceUrl ? `Hosted invoice: ${input.hostedInvoiceUrl}` : null,
    input.invoicePdfUrl ? `Invoice PDF: ${input.invoicePdfUrl}` : null,
  ]
    .filter((value): value is string => value !== null)
    .join("\n");
  const bodyText = `Invoice date: ${input.invoiceDate}\nDue date: ${input.dueDate}\nAmount: ${input.amount}${textActions ? `\n\n${textActions}` : ""}`;

  return renderEmail({
    brand: "altitutor",
    subject: `Invoice ${input.invoiceNumber} is ready — Altitutor`,
    previewText: `Invoice ${input.invoiceNumber} for ${input.amount} is ready.`,
    heading,
    bodyText,
    bodyHtml: `
      <p class="email-copy" style="${paragraphStyle}">Your Altitutor invoice is ready. Stripe securely hosts the invoice and payment page.</p>
      <table class="email-panel" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#eaf1f3" style="margin:22px 0;background-color:#eaf1f3;border:1px solid #d1e0e5;border-radius:12px">
        <tr><td style="padding:12px 20px;border-bottom:1px solid #d1e0e5;color:#52606a;font-size:14px">Invoice date</td><td align="right" style="padding:12px 20px;border-bottom:1px solid #d1e0e5;color:#223b4b;font-size:14px;font-weight:600">${escapeEmailHtml(input.invoiceDate)}</td></tr>
        <tr><td style="padding:12px 20px;border-bottom:1px solid #d1e0e5;color:#52606a;font-size:14px">Due date</td><td align="right" style="padding:12px 20px;border-bottom:1px solid #d1e0e5;color:#223b4b;font-size:14px;font-weight:600">${escapeEmailHtml(input.dueDate)}</td></tr>
        <tr><td style="padding:14px 20px;color:#52606a;font-size:14px">Amount</td><td align="right" style="padding:14px 20px;color:#0a2941;font-size:18px;font-weight:700">${escapeEmailHtml(input.amount)}</td></tr>
      </table>
      ${hostedAction}
      ${pdfAction}
    `,
  });
}

export function buildContactRequestEmail(input: {
  appName: string;
  message: string;
  user?: {
    name?: string | null;
    email?: string | null;
    id?: string | null;
  };
  contact?: {
    email?: string | null;
    phone?: string | null;
  };
  diagnostics?: Record<string, unknown>;
}): RenderedEmail {
  const diagnostics = JSON.stringify(input.diagnostics ?? {}, null, 2);
  const replyTo = input.contact?.email || input.user?.email || EMAIL_SENDERS.altitutor.replyTo;
  const userName = input.user?.name ?? "Unknown";
  const userEmail = input.user?.email ?? "no email";
  const userId = input.user?.id ?? "unknown";
  const contactPhone = input.contact?.phone ?? "not provided";
  const text = `Contact request\n\nApp: ${input.appName}\nUser: ${userName} (${userEmail})\nUser ID: ${userId}\nReply email: ${replyTo}\nPhone: ${contactPhone}\n\nMessage\n${input.message}\n\nDiagnostics\n${diagnostics}`;

  return {
    subject: `[${input.appName}] Contact request`,
    previewText: `Contact request from ${userName}`,
    from: EMAIL_SENDERS.altitutor.from,
    replyTo,
    text,
    html: `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Contact request</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a"><h2>Contact request</h2><p><strong>App:</strong> ${escapeEmailHtml(input.appName)}</p><p><strong>User:</strong> ${escapeEmailHtml(userName)} (${escapeEmailHtml(userEmail)})</p><p><strong>User ID:</strong> ${escapeEmailHtml(userId)}</p><p><strong>Reply email:</strong> ${escapeEmailHtml(replyTo)}</p><p><strong>Phone:</strong> ${escapeEmailHtml(contactPhone)}</p><h3>Message</h3><p>${textWithBreaks(input.message)}</p><h3>Diagnostics</h3><pre>${escapeEmailHtml(diagnostics)}</pre></body></html>`,
  };
}
