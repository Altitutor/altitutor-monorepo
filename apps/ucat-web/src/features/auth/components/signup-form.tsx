"use client";

import type { AuthError } from "@supabase/supabase-js";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { agentDebugLog, probeAuthCookies } from "@/lib/agent-debug-log";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthPageHeader } from "@/features/auth/components/auth-page-header";
import { authFormFieldClass } from "@/features/auth/lib/auth-form-field-class";
import { useAuthPageEntrance } from "@/features/auth/hooks/use-auth-page-entrance";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

const MONTHLY_PRICE_ID = "price_1TUoHxKMw7Xacevsm4h5ulH8";

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

  const containerRef = useAuthPageEntrance(formState);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    const normalizedEmail = email.trim().toLowerCase();

    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=/signup/flow`
        : "/auth/callback?next=/signup/flow";

    try {
      if (newsletter) {
        void subscribeToNewsletter(normalizedEmail);
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: callbackUrl,
          data: {
            pending_redirect: redirectTo,
            pending_price_id:
              redirectTo.includes("plan=monthly") ? MONTHLY_PRICE_ID : null,
          },
        },
      });

      if (error) {
        setErrorMessage(getSignupOtpUserMessage(error));
        setFormState("error");
        return;
      }

      agentDebugLog({
        hypothesisId: "H2-H5",
        location: "signup-form.tsx:after_signInWithOtp_ok",
        message: "signInWithOtp succeeded; probe cookies for PKCE storage",
        data: {
          ...probeAuthCookies(),
          origin: typeof window !== "undefined" ? window.location.origin : "",
        },
      });

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
    const normalizedEmail = email.trim().toLowerCase();

    const tryTypes = ["email", "signup", "magiclink"] as const;
    let lastError: AuthError | null = null;
    for (const type of tryTypes) {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: digits,
        type,
      });
      if (!error) {
        agentDebugLog({
          hypothesisId: "post-fix",
          location: "signup-form.tsx:verifyOtp_ok",
          message: "verifyOtp succeeded",
          data: { usedType: type },
          runId: "post-fix",
        });
        setOtpSubmitting(false);
        router.push("/signup/flow");
        router.refresh();
        return;
      }
      lastError = error;
    }

    setOtpSubmitting(false);
    agentDebugLog({
      hypothesisId: "post-fix",
      location: "signup-form.tsx:verifyOtp_err",
      message: "verifyOtp failed for email and signup types",
      data: {
        errLen: lastError?.message?.length ?? 0,
        errStatus: lastError?.status ?? null,
      },
      runId: "post-fix",
    });
    setOtpError(
      lastError
        ? getSignupOtpUserMessage(lastError)
        : "Invalid code. Try again or request a new email.",
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-dvh flex-col bg-background text-foreground"
    >
      <div className="auth-entrance">
        <AuthPageHeader />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        {formState === "submitted" ? (
          <div className="w-full max-w-md text-center">
            <div className="auth-entrance mb-6 flex items-center justify-center">
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
                "auth-entrance mb-3 text-3xl font-bold text-foreground",
                typo.headingSans,
              )}
            >
              Check your inbox
            </h2>
            <p className={cn("auth-entrance text-muted-foreground", typo.secondarySans)}>
              We&apos;ve sent a confirmation email to{" "}
              <span className="font-medium text-primary">{email}</span>. Use the main
              &quot;Confirm email&quot; button in the email (works in any browser), or enter the
              6-digit code below.
            </p>
            <p
              className={cn(
                "auth-entrance mt-2 text-xs text-muted-foreground/80",
                typo.secondarySans,
              )}
            >
              Avoid the long <span className="font-mono">supabase.co</span> link — that only works
              in the same browser where you signed up.
            </p>
            <p
              className={cn(
                "auth-entrance mt-4 text-sm text-muted-foreground",
                typo.secondarySans,
              )}
            >
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                type="button"
                onClick={() => setFormState("idle")}
                className="text-primary underline underline-offset-2 transition-colors hover:text-foreground"
              >
                try again
              </button>
              .
            </p>

            <form
              onSubmit={onVerifyOtp}
              className={cn(
                "auth-entrance mt-10 space-y-4 rounded-2xl border border-border bg-card p-6 text-left text-card-foreground",
                typo.secondarySans,
              )}
            >
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code from your email (works in any browser or incognito).
              </p>
              <div className="space-y-1.5">
                <label htmlFor="signup-otp" className="block text-sm font-medium text-foreground/90">
                  6-digit code
                </label>
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
                className={`w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${typo.secondarySans}`}
              >
                {otpSubmitting ? "Verifying…" : "Continue with code"}
              </button>
            </form>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="mb-10">
              <span
                className={cn(
                  "auth-entrance text-xs font-bold uppercase tracking-[0.2em] text-primary",
                  typo.dataMono,
                )}
              >
                Alti UCAT
              </span>
              <h1
                className={cn(
                  "auth-entrance mt-2 text-4xl font-bold leading-tight text-foreground sm:text-5xl",
                  typo.headingSans,
                )}
              >
                Start your{" "}
                <span className={`italic text-muted-foreground ${typo.dramaSerif}`}>
                  free trial
                </span>
              </h1>
              <p
                className={cn(
                  "auth-entrance mt-3 text-muted-foreground",
                  typo.secondarySans,
                )}
              >
                7-day free trial, on us.
              </p>
            </div>

            <form
              onSubmit={onSubmit}
              className={cn(
                "auth-entrance space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm backdrop-blur-sm",
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
                className={`w-full rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${typo.headingSans}`}
              >
                {isSubmitting ? "Sending link…" : "Register"}
              </button>
            </form>

            <p
              className={cn(
                "auth-entrance mt-6 text-center text-sm text-muted-foreground",
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
        )}
      </main>
    </div>
  );
}
