"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
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
    const previouslyHandledQuery = handledQueryRef.current;
    if (previouslyHandledQuery === queryKey) return;
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

    // Supabase removes a successfully consumed PKCE code with replaceState().
    // If that URL mutation reaches useSearchParams before navigation completes,
    // it is cleanup for the active callback rather than a second failed callback.
    const hasAuthPayload = Boolean(
      code || tokenHash || queryError || fragmentError,
    );
    if (!hasAuthPayload && previouslyHandledQuery !== null) return;

    const finish = (
      errorMessage: string,
      failureStage: string,
      errorCode?: string | null,
    ) => {
      Sentry.captureMessage("Auth callback failed", {
        level: "warning",
        fingerprint: [
          "auth-callback-failed",
          "ucat-web",
          failureStage,
          provider ?? "unknown",
        ],
        tags: {
          app: "ucat-web",
          auth_error_code: errorCode ?? "unknown",
          auth_failure_stage: failureStage,
          auth_intent: intent,
          auth_provider: provider ?? "unknown",
        },
        extra: {
          error_message: errorMessage,
          has_code: Boolean(code),
          has_query_error: Boolean(queryError || fragmentError),
          has_token_hash: Boolean(tokenHash),
        },
      });
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
          finish(
            metadataError.message || "Could not finish social signup.",
            "signup_metadata",
            metadataError.code,
          );
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

    const continueAfterEmailAuth = () => {
      const continueUrl = new URL("/auth/continue", window.location.origin);
      continueUrl.searchParams.set("intent", intent);
      continueUrl.searchParams.set("next", next);
      navigateAfterAuth(`${continueUrl.pathname}${continueUrl.search}`);
    };

    void (async () => {
      if (queryError || fragmentError) {
        finish(
          queryError || fragmentError || "Authentication was cancelled.",
          "provider_redirect",
          searchParams.get("error_code") ?? searchParams.get("error"),
        );
        return;
      }

      if (tokenHash) {
        const typesToTry = otpTypeFromParam(typeParam);
        let lastVerifyError: { message: string; code?: string } | null = null;
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
            if (isRecoveryFlow || typeParam === "email_change") {
              navigateAfterAuth(next);
            } else {
              continueAfterEmailAuth();
            }
            return;
          }
          lastVerifyError = error;
        }
        finish(
          lastVerifyError?.message ?? "auth_failed",
          "otp_verification",
          lastVerifyError?.code,
        );
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
            if (isRecoveryFlow) navigateAfterAuth(next);
            else continueAfterEmailAuth();
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
            "pkce_exchange",
            error.code,
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
        if (isRecoveryFlow || typeParam === "email_change") {
          navigateAfterAuth(next);
        } else {
          continueAfterEmailAuth();
        }
        return;
      }

      finish("auth_failed", "missing_payload");
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
