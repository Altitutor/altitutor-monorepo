import {
  escapeEmailHtml,
  renderEmail,
  renderEmailButton,
  type RenderedEmail,
} from "./render-email";

export type AuthEmailName =
  | "confirmation"
  | "invite"
  | "magic_link"
  | "recovery"
  | "email_change"
  | "reauthentication";

type AuthEmailFamily = Record<AuthEmailName, RenderedEmail>;

const copyStyle = "margin:0 0 18px;color:#394650;font-size:15px;line-height:1.7";
const mutedStyle = "margin:0;color:#68757e;font-size:13px;line-height:1.6";

function codePanel(label: string, token: string): string {
  return `<table class="email-panel" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#eaf1f3" style="margin:28px 0;background-color:#eaf1f3;border:1px solid #d1e0e5;border-radius:12px"><tr><td align="center" style="padding:22px 18px">
    <p class="email-muted" style="margin:0 0 8px;color:#52606a;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">${escapeEmailHtml(label)}</p>
    <p class="email-heading" style="margin:0;color:#0a2941;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:800;letter-spacing:0.28em">${token}</p>
  </td></tr></table>`;
}

function identityEmail(input: {
  subject: string;
  previewText: string;
  heading: string;
  bodyHtml: string;
  bodyText: string;
  year: number | string;
}): RenderedEmail {
  return renderEmail({
    brand: "altitutor",
    ...input,
  });
}

export function buildAuthEmails(input: {
  year?: number | string;
} = {}): AuthEmailFamily {
  const year = input.year ?? new Date().getUTCFullYear();
  const token = "{{ .Token }}";
  const confirmationUrl = "{{ .ConfirmationURL }}";
  const recoveryUrl = "{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery";

  return {
    confirmation: identityEmail({
      year,
      subject: "Your Altitutor signup code",
      previewText: "Use this code to finish creating your Altitutor account.",
      heading: "Confirm your email",
      bodyText: `Enter this code on the signup page to confirm your email:\n\n${token}\n\nThis code expires in 1 hour.`,
      bodyHtml: `<p class="email-copy" style="${copyStyle}">Enter this code on the signup page to confirm your email and finish creating your Altitutor account.</p>${codePanel("Your signup code", token)}<p class="email-muted" style="${mutedStyle}">This code expires in 1 hour. If you did not request it, you can safely ignore this email.</p>`,
    }),
    invite: identityEmail({
      year,
      subject: "You have been invited to Altitutor",
      previewText: "Accept your invitation to create an Altitutor account.",
      heading: "You have been invited",
      bodyText: `You have been invited to create an Altitutor account.\n\nAccept invitation: ${confirmationUrl}`,
      bodyHtml: `<p class="email-copy" style="${copyStyle}">You have been invited to create an Altitutor account. Accept the invitation to get started.</p>${renderEmailButton(confirmationUrl, "Accept invitation")}<p class="email-muted" style="margin:0;color:#68757e;font-size:13px;line-height:1.6">If you did not expect this invitation, you can safely ignore this email.</p>`,
    }),
    magic_link: identityEmail({
      year,
      subject: "Your Altitutor sign-in code",
      previewText: "Use this code to sign in to Altitutor.",
      heading: "Sign in to Altitutor",
      bodyText: `Enter this code on the sign-in page:\n\n${token}\n\nThis code expires in 1 hour.`,
      bodyHtml: `<p class="email-copy" style="${copyStyle}">Enter this code on the sign-in page to continue.</p>${codePanel("Your sign-in code", token)}<p class="email-muted" style="${mutedStyle}">This code expires in 1 hour. If you did not request it, you can safely ignore this email.</p>`,
    }),
    recovery: identityEmail({
      year,
      subject: "Reset your Altitutor password",
      previewText: "Choose a new password for your Altitutor account.",
      heading: "Reset your password",
      bodyText: `We received a request to reset your Altitutor password.\n\nReset password: ${recoveryUrl}\n\nThis link expires in 1 hour.`,
      bodyHtml: `<p class="email-copy" style="${copyStyle}">We received a request to reset the password for your Altitutor account. Choose a new password using the button below.</p>${renderEmailButton(recoveryUrl, "Reset password")}<p class="email-muted" style="margin:0;color:#68757e;font-size:13px;line-height:1.6">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email and your password will remain unchanged.</p>`,
    }),
    email_change: identityEmail({
      year,
      subject: "Confirm your Altitutor email change",
      previewText: "Confirm the new email address for your Altitutor account.",
      heading: "Confirm your new email",
      bodyText: `You asked to change your Altitutor email address to {{ .NewEmail }}.\n\nConfirm new email: ${confirmationUrl}`,
      bodyHtml: `<p class="email-copy" style="${copyStyle}">You asked to change the email address on your Altitutor account to <strong class="email-strong" style="color:#0a2941">{{ .NewEmail }}</strong>.</p>${renderEmailButton(confirmationUrl, "Confirm new email")}<p class="email-muted" style="margin:0;color:#68757e;font-size:13px;line-height:1.6">If you did not request this change, you can safely ignore this email and your current email address will remain unchanged.</p>`,
    }),
    reauthentication: identityEmail({
      year,
      subject: "Your Altitutor verification code",
      previewText: "Use this code to confirm your identity.",
      heading: "Confirm your identity",
      bodyText: `Use this verification code to complete the security-sensitive action you requested:\n\n${token}\n\nThis code expires in 1 hour.`,
      bodyHtml: `<p class="email-copy" style="${copyStyle}">Use this verification code to complete the security-sensitive action you requested.</p>${codePanel("Verification code", token)}<p class="email-muted" style="${mutedStyle}">This code expires in 1 hour. If you did not request it, you can safely ignore this email. Your account remains secure.</p>`,
    }),
  };
}
