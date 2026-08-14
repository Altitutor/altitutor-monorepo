"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { otpTypeFromParam, safeNextPath } from "./auth-callback-utils";
import {
  isSocialAuthProvider,
  normalizeReferralCode,
  parseSocialAuthIntent,
} from "@/features/auth/lib/social-auth";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";
import { captureUcatEvent } from "@/lib/analytics/posthog";
import { pathWithReturnIntent } from "@/features/auth/lib/return-intent";
import { rememberLastSignInMethod } from "@/features/auth/lib/last-sign-in-method";

/**
 * Completes email signup/sign-in: token_hash (any browser) or PKCE code exchange (same browser).
 */
function AuthCallbackInner() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");
  // useSearchParams() can change object identity without the query changing.
  // Re-running exchangeCodeForSession burns the PKCE verifier (Supabase 400 on
  // /token) and soft-nav spam can trip Safari's history rate limit.
  const handledQueryRef = useRef<string | null>(null);

  useEffect(() => {
    const queryKey = searchParams.toString();
    if (handledQueryRef.current === queryKey) return;
    handledQueryRef.current = queryKey;

    const code = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const typeParam = searchParams.get("type");
    const next = safeNextPath(searchParams.get("next"), typeParam);
    const isRecoveryFlow =
      typeParam === "recovery" || next === "/reset-password";
    const intent = parseSocialAuthIntent(searchParams.get("intent"));
    const providerParam = searchParams.get("provider");
    const provider = isSocialAuthProvider(providerParam) ? providerParam : null;
    const isSocialAuthCallback = provider !== null;
    const queryError =
      searchParams.get("error_description") ?? searchParams.get("error");
    const fragmentError = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    ).get("error_description");

    const finish = (errorMessage: string) => {
      setMessage(errorMessage);
      const errorPath = isRecoveryFlow
        ? `/forgot-password?error=${encodeURIComponent(errorMessage)}`
        : intent === "link"
          ? `/settings/profile?identity_error=${encodeURIComponent(errorMessage)}`
          : pathWithReturnIntent(
              intent === "login" ? "/login" : "/signup",
              next,
              { error: errorMessage },
            );
      navigateAfterAuth(errorPath);
    };

    const supabase = getSupabaseBrowserClient();

    const continueAfterSocialAuth = async () => {
      if (!provider) return false;

      if (intent === "signup") {
        const referralCode = normalizeReferralCode(searchParams.get("ref"));
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            pending_newsletter_opt_in: true,
            pending_referral_code: referralCode,
          },
        });
        if (metadataError) {
          finish(metadataError.message || "Could not finish social signup.");
          return true;
        }

        captureUcatEvent("signup_completed", {
          auth_provider: provider,
          referral_present: Boolean(referralCode),
        });
      }

      if (intent === "login" || intent === "signup") {
        rememberLastSignInMethod(provider);
      }

      const continueUrl = new URL("/auth/continue", window.location.origin);
      continueUrl.searchParams.set("intent", intent);
      continueUrl.searchParams.set("provider", provider);
      continueUrl.searchParams.set("next", next);
      navigateAfterAuth(`${continueUrl.pathname}${continueUrl.search}`);
      return true;
    };

    void (async () => {
      if (queryError || fragmentError) {
        finish(queryError || fragmentError || "Authentication was cancelled.");
        return;
      }

      if (tokenHash) {
        const typesToTry = otpTypeFromParam(typeParam);
        let lastVerifyError: { message: string } | null = null;
        for (const otpType of typesToTry) {
          const { error } = await supabase.auth.verifyOtp({
            type: otpType,
            token_hash: tokenHash,
          });
          if (!error) {
            if (typeParam === "email_change") {
              await fetch("/api/ucat/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ syncEmailFromAuth: true }),
              }).catch(() => undefined);
            }
            navigateAfterAuth(next);
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
            if (isSocialAuthCallback && (await continueAfterSocialAuth())) {
              return;
            }
            navigateAfterAuth(next);
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
        if (isSocialAuthCallback && (await continueAfterSocialAuth())) {
          return;
        }
        if (typeParam === "email_change") {
          await fetch("/api/ucat/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ syncEmailFromAuth: true }),
          }).catch(() => undefined);
        }
        navigateAfterAuth(next);
        return;
      }

      finish("auth_failed");
    })();
  }, [searchParams]);

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
