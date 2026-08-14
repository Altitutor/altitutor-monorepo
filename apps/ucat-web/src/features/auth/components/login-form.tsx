"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@altitutor/ui";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  SocialAuthButtons,
  SocialAuthDivider,
} from "@/features/auth/components/social-auth-buttons";
import { type SocialAuthProvider } from "@/features/auth/lib/social-auth";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";
import { takePendingLoginEmail } from "@/features/auth/lib/pending-login-email";
import {
  getLastSignInMethod,
  rememberLastSignInMethod,
} from "@/features/auth/lib/last-sign-in-method";
import { savePasswordAuthHandoff } from "@/features/auth/lib/password-auth-handoff";

const { typography: typo } = MARKETING_TOKENS;

export function LoginForm({
  redirectTo = "/dashboard",
  initialEmail = "",
  accountExists = false,
  resetSuccess = false,
  enabledSocialProviders = [],
  authError,
}: {
  redirectTo?: string;
  initialEmail?: string;
  accountExists?: boolean;
  resetSuccess?: boolean;
  enabledSocialProviders?: SocialAuthProvider[];
  authError?: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [lastSignInMethod, setLastSignInMethod] =
    useState<ReturnType<typeof getLastSignInMethod>>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLastSignInMethod(getLastSignInMethod());
    if (accountExists && !initialEmail) {
      setEmail(takePendingLoginEmail() ?? "");
    }
  }, [accountExists, initialEmail]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      {
        email,
        password,
      },
    );

    if (signInError) {
      setError("Incorrect email or password.");
      setIsSubmitting(false);
      return;
    }

    rememberLastSignInMethod("password");
    if (data.user) savePasswordAuthHandoff(data.user.id);

    const continueUrl = new URL("/auth/continue", window.location.origin);
    continueUrl.searchParams.set("intent", "login");
    continueUrl.searchParams.set("next", redirectTo);
    navigateAfterAuth(`${continueUrl.pathname}${continueUrl.search}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm",
        typo.secondarySans,
      )}
    >
      {enabledSocialProviders.length > 0 ? (
        <>
          <SocialAuthButtons
            enabledProviders={enabledSocialProviders}
            intent="login"
            redirectTo={redirectTo}
          />
          <SocialAuthDivider />
        </>
      ) : null}
      {authError ? (
        <p
          className="auth-feedback-entrance rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {authError}
        </p>
      ) : null}
      {accountExists ? (
        <p
          className="auth-feedback-entrance rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          An account with this email already exists. Sign in below.
        </p>
      ) : null}
      {resetSuccess ? (
        <p
          className="auth-feedback-entrance rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Your password has been reset. You can now sign in with your new
          password.
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-sm font-medium text-foreground/90"
        >
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isSubmitting}
          className="h-auto min-h-[48px] rounded-xl border-border px-4 py-3 text-base"
        />
      </div>
      {/* Grid places Forgot password beside the label visually while DOM
          order keeps tab as: password → sign in → forgot password. */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5">
        <Label
          htmlFor="password"
          className="col-start-1 row-start-1 text-sm font-medium text-foreground/90"
        >
          Password
          {lastSignInMethod === "password" ? (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Last used
            </span>
          ) : null}
        </Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          autoFocus={accountExists}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          className="col-span-2 row-start-2 h-auto min-h-[48px] rounded-xl border-border px-4 py-3 text-base"
        />
        <div className="col-span-2 row-start-3 mt-3.5 space-y-5">
          {error ? (
            <p
              className="auth-feedback-entrance rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "auth-submit h-auto w-full rounded-full py-3.5 text-base font-semibold",
              typo.headingSans,
            )}
            size="lg"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </div>
        <Link
          href="/forgot-password"
          className="col-start-2 row-start-1 text-sm font-medium text-primary underline-offset-2 transition-colors hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
