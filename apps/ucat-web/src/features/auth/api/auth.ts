import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function isRateLimitError(error: { status?: number; code?: string; message?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    msg.includes("rate limit")
  );
}

export const authApi = {
  /**
   * Request a password reset email. Shows generic success unless rate-limited.
   */
  async requestPasswordReset(email: string): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("This method must be called from the browser");
    }

    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error && isRateLimitError(error)) {
      throw new Error(
        "Too many reset emails were requested. Please wait several minutes, then try again.",
      );
    }
  },

  /**
   * Set a new password using the active recovery session.
   */
  async confirmPasswordReset(password: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error(
        "Invalid or expired reset session. Please request a new password reset.",
      );
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      throw new Error(error.message || "Failed to reset password. Please try again.");
    }
  },
};
