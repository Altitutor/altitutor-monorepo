const MAX_EMAIL_LENGTH = 320;

export const INVALID_SIGNUP_EMAIL_MESSAGE = "Enter a valid email address.";
export const SIGNUP_EMAIL_LOCAL_PART_DOTS_MESSAGE =
  "Check your email address. The part before the @ can't start or end with a dot or contain two dots in a row.";

/**
 * Returns a user-facing reason when signup cannot send a confirmation email
 * to this normalized address, or null when it can be attempted.
 *
 * Browser `type="email"` validation and Supabase Auth accept any dots in the
 * local part, but Auth's mailer only accepts a dot-atom local part and fails
 * the OTP request with HTTP 500 otherwise.
 */
export function signupEmailAddressError(email: string): string | null {
  if (!email || !email.includes("@") || email.length > MAX_EMAIL_LENGTH) {
    return INVALID_SIGNUP_EMAIL_MESSAGE;
  }

  const localPart = email.slice(0, email.lastIndexOf("@"));
  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    return SIGNUP_EMAIL_LOCAL_PART_DOTS_MESSAGE;
  }

  return null;
}
