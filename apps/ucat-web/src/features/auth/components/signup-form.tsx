"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";

const { typography: typo } = MARKETING_TOKENS;

const MONTHLY_PRICE_ID = "price_1TUoHxKMw7Xacevsm4h5ulH8";

type FormState = "idle" | "submitted" | "error";

export function SignupForm({ redirectTo = "/subscribe" }: { redirectTo?: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(true);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=/signup/flow`
        : "/auth/callback?next=/signup/flow";

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl,
        data: {
          newsletter_opt_in: newsletter,
          pending_redirect: redirectTo,
          pending_price_id:
            redirectTo.includes("plan=monthly") ? MONTHLY_PRICE_ID : null,
        },
      },
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message ?? "Something went wrong. Please try again.");
      setFormState("error");
      return;
    }

    setFormState("submitted");
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-marketing-charcoal">
      <NoiseOverlay />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logo-banner-darkmode.svg"
            alt="Alti UCAT"
            width={140}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>
        <Link
          href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
          className={`text-sm text-marketing-cream/60 transition-colors hover:text-marketing-cream ${typo.secondarySans}`}
        >
          Sign in
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        {formState === "submitted" ? (
          <div className="w-full max-w-md text-center">
            <div className="mb-6 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-marketing-accent/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-8 w-8 text-marketing-accent"
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
              className={`mb-3 text-3xl font-bold text-marketing-cream ${typo.headingSans}`}
            >
              Check your inbox
            </h2>
            <p
              className={`text-marketing-cream/60 ${typo.secondarySans}`}
            >
              We&apos;ve sent a confirmation link to{" "}
              <span className="text-marketing-accent">{email}</span>. Click the
              link to continue creating your account.
            </p>
            <p className={`mt-4 text-sm text-marketing-cream/40 ${typo.secondarySans}`}>
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                type="button"
                onClick={() => setFormState("idle")}
                className="text-marketing-accent underline hover:text-marketing-cream transition-colors"
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="w-full max-w-md">
            {/* Heading */}
            <div className="mb-10">
              <span
                className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-accent ${typo.dataMono}`}
              >
                Alti UCAT
              </span>
              <h1
                className={`mt-2 text-4xl font-bold leading-tight text-marketing-cream sm:text-5xl ${typo.headingSans}`}
              >
                Start your{" "}
                <span className={`italic text-marketing-cream/80 ${typo.dramaSerif}`}>
                  free trial
                </span>
              </h1>
              <p
                className={`mt-3 text-marketing-cream/60 ${typo.secondarySans}`}
              >
                7-day free trial. No credit card required to confirm your email.
              </p>
            </div>

            {/* Form card */}
            <form
              onSubmit={onSubmit}
              className="space-y-5 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-sm"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="signup-email"
                  className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
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
                  className={`w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-all focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
                />
              </div>

              {/* Newsletter opt-in */}
              <label className="flex cursor-pointer items-start gap-3">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={newsletter}
                    onChange={(e) => setNewsletter(e.target.checked)}
                    disabled={isSubmitting}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-5 rounded-md border border-white/20 bg-white/5 transition-all peer-checked:border-marketing-accent peer-checked:bg-marketing-accent" />
                  <svg
                    viewBox="0 0 12 10"
                    fill="none"
                    className="absolute left-0.5 top-[3px] h-4 w-4 opacity-0 transition-opacity peer-checked:opacity-100"
                  >
                    <path
                      d="M1 5l3.5 3.5L11 1"
                      stroke="#1A1A1A"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className={`text-sm leading-relaxed text-marketing-cream/60 ${typo.secondarySans}`}>
                  Keep me updated with Altitutor news, UCAT resources, and prep
                  tips
                </span>
              </label>

              {errorMessage ? (
                <p className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}>
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className={`w-full rounded-full bg-marketing-accent py-3.5 text-base font-semibold text-marketing-charcoal transition-all hover:bg-marketing-accent/90 disabled:cursor-not-allowed disabled:opacity-50 ${typo.headingSans}`}
              >
                {isSubmitting ? "Sending link…" : "Register"}
              </button>
            </form>

            <p className={`mt-6 text-center text-sm text-marketing-cream/40 ${typo.secondarySans}`}>
              Already have an account?{" "}
              <Link
                href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
                className="text-marketing-accent hover:text-marketing-cream transition-colors"
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
