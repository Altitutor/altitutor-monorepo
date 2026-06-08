"use client";

import type { AuthError } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthPageHeader } from "@/features/auth/components/auth-page-header";
import { authFormFieldClass } from "@/features/auth/lib/auth-form-field-class";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

const RESEND_COOLDOWN_SECONDS = 20;

type FormState = "idle" | "submitted" | "error";

function getSignupOtpUserMessage(error: AuthError): string {
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

async function subscribeToNewsletter(email: string): Promise<void> {
  try {
    const response = await fetch("/api/ucat/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "ucat_signup" }),
    });
    if (!response.ok) {
      console.warn("[signup] Failed to save newsletter preference:", response.status);
    }
  } catch (error) {
    console.warn("[signup] Failed to save newsletter preference:", error);
  }
}

export function SignupForm({ redirectTo = "/subscribe" }: { redirectTo?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(true);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function getCallbackUrl() {
    return typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=/signup/complete`
      : "/auth/callback?next=/signup/complete";
  }

  async function sendConfirmationEmail(
    normalizedEmail: string,
  ): Promise<AuthError | null> {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: getCallbackUrl(),
        data: {
          pending_redirect: redirectTo,
          pending_plan: redirectTo.includes("plan=monthly") ? "monthly" : null,
        },
      },
    });
    return error;
  }

  function returnToSignupForm() {
    setFormState("idle");
    setOtpCode("");
    setOtpError(null);
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
      const checkRes = await fetch("/api/ucat/signup/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (checkRes.ok) {
        const checkData = (await checkRes.json()) as { exists?: boolean };
        if (checkData.exists) {
          const loginParams = new URLSearchParams({
            email: normalizedEmail,
            redirect: redirectTo,
            existing: "1",
          });
          router.push(`/login?${loginParams.toString()}`);
          return;
        }
      }

      if (newsletter) {
        void subscribeToNewsletter(normalizedEmail);
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
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOtpError(null);
    const digits = otpCode.replace(/\D/g, "");
    if (digits.length !== 6) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }

    setOtpSubmitting(true);
    const normalizedEmail = (submittedEmail || email).trim().toLowerCase();

    const tryTypes = ["email", "signup", "magiclink"] as const;
    let lastError: AuthError | null = null;
    for (const type of tryTypes) {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: digits,
        type,
      });
      if (!error) {
        setOtpSubmitting(false);
        router.push("/signup/complete");
        router.refresh();
        return;
      }
      lastError = error;
    }

    setOtpSubmitting(false);
    setOtpError(
      lastError
        ? getSignupOtpUserMessage(lastError)
        : "Invalid code. Try again or request a new email.",
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <AuthPageHeader
        backLabel={formState === "submitted" ? "Back" : "Home"}
        onBack={formState === "submitted" ? returnToSignupForm : undefined}
      />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        {formState === "submitted" ? (
          <div key="submitted" className="auth-entrance w-full max-w-md text-center">
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
              className={cn("mb-3 text-3xl font-bold text-foreground", typo.headingSans)}
            >
              Check your inbox
            </h2>
            <p className={cn("text-muted-foreground", typo.secondarySans)}>
              We&apos;ve sent a confirmation email to{" "}
              <span className="font-medium text-foreground">{submittedEmail}</span>.
            </p>
            <form
              onSubmit={onVerifyOtp}
              className={cn(
                "mt-10 space-y-4 rounded-2xl border border-border bg-card p-6 text-left text-card-foreground",
                typo.secondarySans,
              )}
            >
              <p className="text-sm text-muted-foreground">
                Alternatively, enter the 6-digit code from your email.
              </p>
              <div className="space-y-1.5">
                <input
                  id="signup-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                  "w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40",
                  typo.secondarySans,
                )}
              >
                {otpSubmitting ? "Verifying…" : "Continue with code"}
              </button>
            </form>
            <p className={cn("mt-4 text-sm text-muted-foreground", typo.secondarySans)}>
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
          <div key="idle" className="auth-entrance w-full max-w-md">
            <div className="mb-10">
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-[0.2em] text-primary",
                  typo.dataMono,
                )}
              >
                Alti UCAT
              </span>
              <h1
                className={cn(
                  "mt-2 text-4xl font-bold leading-tight text-foreground sm:text-5xl",
                  typo.headingSans,
                )}
              >
                Start with{" "}
                <span className={`italic text-muted-foreground ${typo.dramaSerif}`}>
                  UCAT Free
                </span>
              </h1>
              <p className={cn("mt-3 text-muted-foreground", typo.secondarySans)}>
                Create your account, then choose UCAT Free or try UCAT Unlimited
                free
                for 7 days.
              </p>
            </div>

            <form
              onSubmit={onSubmit}
              className={cn(
                "space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm backdrop-blur-sm",
                typo.secondarySans,
              )}
            >
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

              <label className="flex cursor-pointer items-start gap-3">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={newsletter}
                    onChange={(e) => setNewsletter(e.target.checked)}
                    disabled={isSubmitting}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-5 rounded-md border border-border bg-muted/40 transition-all peer-checked:border-primary peer-checked:bg-primary" />
                  <svg
                    viewBox="0 0 12 10"
                    fill="none"
                    className="absolute left-0.5 top-[3px] h-4 w-4 opacity-0 transition-opacity peer-checked:opacity-100"
                  >
                    <path
                      d="M1 5l3.5 3.5L11 1"
                      stroke="hsl(var(--primary-foreground))"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  Keep me updated with Altitutor news, UCAT resources, and prep
                  tips
                </span>
              </label>

              {errorMessage ? (
                <p className={`rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive ${typo.secondarySans}`}>
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className={cn(
                  "w-full rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
                  typo.headingSans,
                )}
              >
                {isSubmitting ? "Sending link…" : "Register"}
              </button>
            </form>

            <p
              className={cn("mt-6 text-center text-sm text-muted-foreground", typo.secondarySans)}
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
        )}
      </main>
    </div>
  );
}
