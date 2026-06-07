const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;

export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw) return null;
  return (EMAIL_OTP_TYPES as readonly string[]).includes(raw) ? (raw as EmailOtpType) : null;
}

/** Types to try for token_hash / OTP verify (signup uses email or magiclink from signInWithOtp). */
export function otpTypeFromParam(raw: string | null): EmailOtpType[] {
  const parsed = parseEmailOtpType(raw);
  if (parsed) {
    return [parsed, "email", "signup", "magiclink"];
  }
  return ["email", "signup", "magiclink"];
}

/** Only allow same-origin relative redirects after auth. */
export function safeNextPath(next: string | null, type: string | null = null): string {
  if (type === "recovery") {
    return "/reset-password";
  }
  if (next?.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/signup/complete";
}
