"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { otpTypeFromParam, safeNextPath } from "./auth-callback-utils";

/**
 * Completes email signup/sign-in: token_hash (any browser) or PKCE code exchange (same browser).
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const typeParam = searchParams.get("type");
    const next = safeNextPath(searchParams.get("next"), typeParam);
    const isRecoveryFlow = typeParam === "recovery" || next === "/reset-password";

    const finish = (errorMessage: string) => {
      setMessage(errorMessage);
      const errorPath =
        next === "/reset-password"
          ? `/forgot-password?error=${encodeURIComponent(errorMessage)}`
          : `/signup?error=${encodeURIComponent(errorMessage)}`;
      router.replace(errorPath);
    };

    const supabase = getSupabaseBrowserClient();

    void (async () => {
      if (tokenHash) {
        const typesToTry = otpTypeFromParam(typeParam);
        let lastVerifyError: { message: string } | null = null;
        for (const otpType of typesToTry) {
          const { error } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
          });
          if (!error) {
            router.replace(next);
            return;
          }
          lastVerifyError = error;
        }
        finish(lastVerifyError?.message ?? "auth_failed");
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            router.replace(next);
            return;
          }
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.error("[auth/callback] exchangeCodeForSession:", error);
          }
          const isPkceVerifierMissing = error.message
            .toLowerCase()
            .includes("code verifier");
          finish(
            isPkceVerifierMissing
              ? isRecoveryFlow
                ? "This reset link only works in the same browser where you requested it. Request a new reset email and use the Reset Password button in that email (not the long supabase.co link)."
                : "This sign-in link only works in the same browser where you requested it. Use the main button in your email (not the long supabase.co link), or enter the 6-digit code on the signup page."
              : error.message,
          );
          return;
        }
        router.replace(next);
        return;
      }

      finish("auth_failed");
    })();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-marketing-charcoal px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function AuthCallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-marketing-charcoal px-4 text-sm text-muted-foreground">
          Completing sign-in…
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
