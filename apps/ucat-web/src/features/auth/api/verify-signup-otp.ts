export type SignupOtpVerificationError = {
  message: string;
  status?: number;
  code?: string;
};

type SignupOtpVerificationResponse = {
  error: SignupOtpVerificationError | null;
};

function isVerificationResponse(
  value: unknown,
): value is SignupOtpVerificationResponse {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }

  const error = value.error;
  return (
    error === null ||
    (typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string")
  );
}

/**
 * Verifies signup OTPs in a Route Handler so its Set-Cookie response reaches
 * the browser before the first authenticated Server Component request.
 */
export async function verifySignupOtp(input: {
  email: string;
  token: string;
}): Promise<SignupOtpVerificationError | null> {
  try {
    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(input),
    });
    const body: unknown = await response.json().catch(() => null);

    if (isVerificationResponse(body)) {
      return body.error;
    }

    return {
      message: response.ok
        ? "Sign-in completed, but the session response was invalid. Please try again."
        : "We couldn't verify that code. Please try again.",
      status: response.status,
    };
  } catch {
    return {
      message: "We couldn't verify that code. Check your connection and try again.",
    };
  }
}
