"use client";

import React, { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildSocialAuthCallbackUrl,
  type SocialAuthIntent,
  type SocialAuthProvider,
} from "@/features/auth/lib/social-auth";
import { cn } from "@/lib/utils";
import { captureUcatEvent } from "@/lib/analytics/posthog";
import { getLastSignInMethod } from "@/features/auth/lib/last-sign-in-method";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.35l-3.24-2.55c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.63A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6 6 0 0 1 6.07 12c0-.67.12-1.32.32-1.93V7.44H3.04A10 10 0 0 0 2 12c0 1.64.39 3.19 1.04 4.56l3.35-2.63Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.44l3.35 2.63C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current">
      <path d="M16.7 12.9c0-2.5 2-3.7 2.1-3.8a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9a4.9 4.9 0 0 0-4.1 2.5c-1.8 3.1-.5 7.7 1.2 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8s2 .8 3.4.8c1.4 0 2.3-1.2 3.1-2.5a11 11 0 0 0 1.4-2.9 4.4 4.4 0 0 1-3-4Zm-2.5-7.4a4.4 4.4 0 0 0 1-3.2 4.5 4.5 0 0 0-3 1.5 4.2 4.2 0 0 0-1.1 3.1 3.7 3.7 0 0 0 3.1-1.4Z" />
    </svg>
  );
}

const PROVIDER_LABEL: Record<SocialAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
};

export function SocialAuthButtons({
  enabledProviders,
  intent,
  redirectTo,
  referralCode = null,
  className,
}: {
  enabledProviders: SocialAuthProvider[];
  intent: Exclude<SocialAuthIntent, "link">;
  redirectTo: string;
  referralCode?: string | null;
  className?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  const [busyProvider, setBusyProvider] = useState<SocialAuthProvider | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSignInMethod] = useState(getLastSignInMethod);

  if (enabledProviders.length === 0) return null;

  async function continueWith(provider: SocialAuthProvider) {
    setBusyProvider(provider);
    setError(null);

    const callbackUrl = buildSocialAuthCallbackUrl({
      origin: window.location.origin,
      intent,
      provider,
      next: redirectTo,
      referralCode,
    });

    if (intent === "signup") {
      captureUcatEvent("signup_started", {
        auth_provider: provider,
        referral_present: Boolean(referralCode),
        newsletter_opt_in: true,
      });
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    });

    if (oauthError) {
      setError(
        oauthError.message ||
          `Could not continue with ${PROVIDER_LABEL[provider]}.`,
      );
      setBusyProvider(null);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {enabledProviders.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => void continueWith(provider)}
          disabled={busyProvider !== null}
          className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {provider === "google" ? <GoogleIcon /> : <AppleIcon />}
          {busyProvider === provider
            ? `Opening ${PROVIDER_LABEL[provider]}…`
            : `Continue with ${PROVIDER_LABEL[provider]}`}
          {intent === "login" && lastSignInMethod === provider ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Last used
            </span>
          ) : null}
        </button>
      ))}
      {error ? (
        <p
          className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SocialAuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        or
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
