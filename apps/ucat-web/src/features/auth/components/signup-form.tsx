"use client";

import type { AuthError } from "@supabase/supabase-js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthPageHeader } from "@/features/auth/components/auth-page-header";
import { authFormFieldClass } from "@/features/auth/lib/auth-form-field-class";
import { UCAT_ACCENT_FILL_RISE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseSignupPlanIntent } from "@/features/auth/lib/signup-plan-intent";
import type { UcatReferralOfferPreview } from "@/lib/ucat/referrals/capture-referral";
import { captureUcatEvent } from "@/lib/analytics/posthog";
import {
  clearPendingSignupEmail,
  getPendingSignupEmail,
  savePendingSignupEmail,
} from "@/features/auth/lib/pending-signup-email";
import {
  verifySignupOtp,
  type SignupOtpVerificationError,
} from "@/features/auth/api/verify-signup-otp";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";
import {
  SocialAuthButtons,
  SocialAuthDivider,
} from "@/features/auth/components/social-auth-buttons";
import type { SocialAuthProvider } from "@/features/auth/lib/social-auth";
import { subscribeToUcatNewsletter } from "@/features/auth/api/newsletter";
import { UCAT_SIGNUP_CONSENT_WORDING } from "@/features/communications/lib/communication-preferences";
import { pathWithReturnIntent } from "@/features/auth/lib/return-intent";
import { savePendingLoginEmail } from "@/features/auth/lib/pending-login-email";

const { typography: typo } = MARKETING_TOKENS;

const RESEND_COOLDOWN_SECONDS = 20;

type FormState = "idle" | "submitted" | "error";

function getSignupOtpUserMessage(
  error: AuthError | SignupOtpVerificationError,
): string {
  const raw = error.message ?? "";
  const msg = raw.toLowerCase();
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    msg.includes("rate limit")
  ) {
    return "Too many confirmation emails were requested. Please wait several minutes, then try again.";
  }
  if (msg.includes("api key") || msg.includes("no `apikey`")) {
    return "Sign-in could not reach the project (missing anon key). Developers: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/ucat-web/.env.local and restart `pnpm dev`.";
  }
  return raw || "Something went wrong. Please try again.";
}

export function SignupForm({
  redirectTo = "/dashboard",
  referralCode = null,
  referralOffer = null,
  enabledSocialProviders = [],
  authError,
}: {
  redirectTo?: string;
  referralCode?: string | null;
  referralOffer?: UcatReferralOfferPreview | null;
  enabledSocialProviders?: SocialAuthProvider[];
  authError?: string;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    authError ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const otpInFlightRef = useRef(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const planIntent = useMemo(
    () => parseSignupPlanIntent(redirectTo),
    [redirectTo],
  );
  const pendingSignupContext = `${redirectTo}\n${referralCode ?? ""}`;
  const planName = "UCAT Unlimited";
  const planFeatures = [
    "Unlimited practice across every UCAT section",
    "Full-length mocks and percentile tracking",
    "Adaptive skill trainer and progress analytics",
    "Accountability pricing that rewards daily practice",
  ];

  useEffect(() => {
    const pendingEmail = getPendingSignupEmail(pendingSignupContext);
    if (!pendingEmail) return;

    setEmail(pendingEmail);
    setSubmittedEmail(pendingEmail);
    setFormState("submitted");
  }, [pendingSignupContext]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function sendConfirmationEmail(
    normalizedEmail: string,
  ): Promise<AuthError | null> {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        data: {
          pending_redirect: redirectTo,
          pending_plan: planIntent?.tier ?? null,
          pending_billing_interval: planIntent?.interval ?? null,
          pending_referral_code: referralCode,
        },
      },
    });
    return error;
  }

  function returnToSignupForm() {
    clearPendingSignupEmail(pendingSignupContext);
    setFormState("idle");
    setOtpCode("");
    setOtpError(null);
    setOtpSubmitting(false);
    otpInFlightRef.current = false;
    setResendError(null);
    setResendCooldown(0);
  }

  async function onResendConfirmation() {
    if (!submittedEmail || isResending || resendCooldown > 0) return;

    setIsResending(true);
    setResendError(null);

    const error = await sendConfirmationEmail(submittedEmail);

    setIsResending(false);

    if (error) {
      setResendError(getSignupOtpUserMessage(error));
      return;
    }

    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setOtpCode("");
    setOtpError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      captureUcatEvent("signup_started", {
        intended_plan: planIntent?.tier ?? "free",
        billing_interval: planIntent?.interval ?? null,
        referral_present: Boolean(referralCode),
        newsletter_opt_in: true,
      });

      const accountStateResponse = await fetch(
        "/api/auth/signup-account-state",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ email: normalizedEmail }),
        },
      ).catch(() => null);
      const accountState = (await accountStateResponse
        ?.json()
        .catch(() => null)) as { state?: string; error?: string } | null;
      if (!accountStateResponse?.ok) {
        setErrorMessage(
          accountState?.error ??
            "We couldn't check this email right now. Please try again.",
        );
        return;
      }
      if (accountState?.state === "confirmed") {
        savePendingLoginEmail(normalizedEmail);
        navigateAfterAuth(
          pathWithReturnIntent("/login", redirectTo, { existing: "1" }),
        );
        return;
      }

      const error = await sendConfirmationEmail(normalizedEmail);

      if (error) {
        setErrorMessage(getSignupOtpUserMessage(error));
        setFormState("error");
        return;
      }

      setSubmittedEmail(normalizedEmail);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendError(null);
      setOtpCode("");
      setOtpError(null);
      setFormState("submitted");
      savePendingSignupEmail(normalizedEmail, pendingSignupContext);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (otpInFlightRef.current) return;

    setOtpError(null);
    const digits = otpCode.replace(/\D/g, "");
    if (digits.length !== 6) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }

    otpInFlightRef.current = true;
    setOtpSubmitting(true);
    const normalizedEmail = (submittedEmail || email).trim().toLowerCase();

    try {
      const error = await verifySignupOtp({
        email: normalizedEmail,
        token: digits,
      });
      if (!error) {
        await subscribeToUcatNewsletter("ucat_email_signup");
        clearPendingSignupEmail(pendingSignupContext);
        captureUcatEvent("signup_completed", {
          intended_plan: planIntent?.tier ?? "free",
          billing_interval: planIntent?.interval ?? null,
          referral_present: Boolean(referralCode),
        });
        const continueUrl = new URL("/auth/continue", window.location.origin);
        continueUrl.searchParams.set("intent", "signup");
        continueUrl.searchParams.set(
          "next",
          planIntent?.checkoutPath ?? redirectTo,
        );
        navigateAfterAuth(`${continueUrl.pathname}${continueUrl.search}`);
        // Leave otpSubmitting true so the button stays locked during navigation.
        return;
      }

      setOtpError(getSignupOtpUserMessage(error));
      otpInFlightRef.current = false;
      setOtpSubmitting(false);
    } catch {
      otpInFlightRef.current = false;
      setOtpSubmitting(false);
      setOtpError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <AuthPageHeader
        backLabel={formState === "submitted" ? "Back" : "Home"}
        onBack={formState === "submitted" ? returnToSignupForm : undefined}
      />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        {formState === "submitted" ? (
          <div
            key="submitted"
            className="auth-entrance w-full max-w-md text-center"
          >
            <div className="mb-6 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-8 w-8 text-primary"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </span>
            </div>
            <h2
              className={cn(
                "mb-3 text-3xl font-bold text-foreground",
                typo.headingSans,
              )}
            >
              Check your inbox
            </h2>
            <p className={cn("text-muted-foreground", typo.secondarySans)}>
              We&apos;ve sent a confirmation email to{" "}
              <span className="font-medium text-foreground">
                {submittedEmail}
              </span>
              .
            </p>
            <form
              onSubmit={onVerifyOtp}
              className={cn(
                "mt-10 space-y-4 rounded-2xl border border-border bg-card p-6 text-left text-card-foreground shadow-sm",
                typo.secondarySans,
              )}
            >
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code from your email.
              </p>
              <div className="space-y-1.5">
                <input
                  id="signup-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  aria-label="6-digit code"
                  placeholder="000000"
                  disabled={otpSubmitting}
                  className={`text-center font-mono text-lg tracking-[0.4em] ${authFormFieldClass}`}
                />
              </div>
              {otpError ? (
                <p className="text-sm text-destructive" role="alert">
                  {otpError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={otpSubmitting || otpCode.length !== 6}
                className={cn(
                  UCAT_ACCENT_FILL_RISE,
                  "auth-submit w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40",
                  typo.secondarySans,
                )}
              >
                {otpSubmitting ? "Verifying…" : "Continue with code"}
              </button>
            </form>
            <p
              className={cn(
                "mt-4 text-sm text-muted-foreground",
                typo.secondarySans,
              )}
            >
              Didn&apos;t receive it? Check your spam folder
              {resendCooldown > 0 ? (
                <>
                  {" "}
                  or resend in{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {resendCooldown}s
                  </span>
                  .
                </>
              ) : (
                <>
                  {" "}
                  or{" "}
                  <button
                    type="button"
                    onClick={() => void onResendConfirmation()}
                    disabled={isResending}
                    className="text-primary underline underline-offset-2 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isResending ? "sending…" : "resend email"}
                  </button>
                  .
                </>
              )}
            </p>
            {resendError ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {resendError}
              </p>
            ) : null}
          </div>
        ) : (
          <div
            key="idle"
            className={cn(
              "auth-entrance w-full",
              planIntent
                ? "grid max-w-5xl gap-12 lg:grid-cols-2 lg:items-center"
                : "max-w-md",
            )}
          >
            <div>
              <div className="mb-10">
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-[0.2em] text-primary",
                    typo.dataMono,
                  )}
                >
                  Altitutor UCAT
                </span>
                <h1
                  className={cn(
                    "mt-2 text-4xl font-bold leading-tight text-foreground sm:text-5xl",
                    typo.headingSans,
                  )}
                >
                  Start with{" "}
                  <span
                    className={`italic text-muted-foreground ${typo.dramaSerif}`}
                  >
                    {referralOffer
                      ? "UCAT Unlimited"
                      : planIntent
                        ? planName
                        : "UCAT Free"}
                  </span>
                </h1>
                <p
                  className={cn(
                    "mt-3 text-muted-foreground",
                    typo.secondarySans,
                  )}
                >
                  {referralOffer
                    ? `You've received a free ${referralOffer.duration} of UCAT Unlimited from ${referralOffer.referrerName}, enter your email to continue.`
                    : planIntent
                      ? `Create your account to continue to ${planName} checkout.`
                      : "Create your account for free by entering your email below."}
                </p>
              </div>

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
                      intent="signup"
                      redirectTo={redirectTo}
                      referralCode={referralCode}
                    />
                    <SocialAuthDivider />
                  </>
                ) : null}
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-email"
                    className="block text-sm font-medium text-foreground/90"
                  >
                    Email address
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                    className={authFormFieldClass}
                  />
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {UCAT_SIGNUP_CONSENT_WORDING}
                </p>

                {errorMessage ? (
                  <p
                    role="alert"
                    className={`auth-feedback-entrance rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ${typo.secondarySans}`}
                  >
                    {errorMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className={cn(
                    UCAT_ACCENT_FILL_RISE,
                    "auth-submit w-full rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50",
                    typo.headingSans,
                  )}
                >
                  {isSubmitting
                    ? "Sending code…"
                    : planIntent
                      ? "Continue"
                      : "Register"}
                </button>
              </form>

              <p
                className={cn(
                  "mt-6 text-center text-sm text-muted-foreground",
                  typo.secondarySans,
                )}
              >
                Already have an account?{" "}
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
                  className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {planIntent ? (
              <aside className="rounded-3xl border border-border/80 bg-card/60 p-8 text-card-foreground shadow-sm lg:p-10">
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-[0.2em] text-primary",
                    typo.dataMono,
                  )}
                >
                  Your selected plan
                </span>
                <h2
                  className={cn(
                    "mt-3 text-3xl font-bold text-foreground",
                    typo.headingSans,
                  )}
                >
                  {planName}
                </h2>
                <p
                  className={cn(
                    "mt-3 text-muted-foreground",
                    typo.secondarySans,
                  )}
                >
                  {planIntent.interval === "year"
                    ? "Annual"
                    : planIntent.interval === "week"
                      ? "Weekly"
                      : "Monthly"}{" "}
                  billing. You&apos;ll review the full price and any trial
                  eligibility before confirming.
                </p>
                <ul className={cn("mt-8 space-y-4", typo.secondarySans)}>
                  {planFeatures.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm text-foreground/90"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
