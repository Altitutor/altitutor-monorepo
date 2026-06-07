"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  PhoneInput,
  isPhoneCountryCodeOnly,
  validateOptionalStudentPhone,
} from "@altitutor/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { NoiseOverlay } from "@/features/landing/components/marketing/noise-overlay";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

const signupPhoneInputClassName = cn(
  "[&_.PhoneInputInput]:h-12 [&_.PhoneInputInput]:rounded-xl [&_.PhoneInputInput]:border-white/10 [&_.PhoneInputInput]:bg-white/5 [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:text-marketing-cream [&_.PhoneInputInput]:placeholder:text-marketing-cream/30 [&_.PhoneInputInput]:focus-visible:border-marketing-accent/50 [&_.PhoneInputInput]:focus-visible:ring-marketing-accent/20",
  "[&>p:last-child]:text-marketing-cream/30",
);

const signupPhoneCountryClassName = cn(
  "[&_button]:h-12 [&_button]:rounded-xl [&_button]:border-white/10 [&_button]:bg-white/5 [&_button]:text-marketing-cream [&_button]:focus-visible:ring-marketing-accent/20",
);

type Step = 1 | 2;

interface SignupCompleteFormProps {
  email: string;
  redirectTo?: string;
}

export function SignupCompleteForm({ email, redirectTo = "/subscribe" }: SignupCompleteFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [step, setStep] = useState<Step>(1);

  // Step 1 fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2 fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  async function handleStep1Next(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPhoneError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    const phoneResult = validateOptionalStudentPhone(phone);
    if (phoneResult.error) {
      setPhoneError(phoneResult.error);
      return;
    }

    const payload: {
      firstName: string;
      lastName: string;
      phone?: string | null;
    } = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isPhoneCountryCodeOnly(trimmedPhone)) {
      payload.phone = phoneResult.phone;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/ucat/signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save details. Please try again.");
        return;
      }

      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStep2Next(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message ?? "Failed to set password.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Step indicators */}
          <div className="mb-10 flex items-center gap-3">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    s === step
                      ? "bg-marketing-accent text-marketing-charcoal"
                      : s < step
                        ? "bg-marketing-accent/30 text-marketing-accent"
                        : "bg-white/10 text-marketing-cream/30"
                  } ${typo.dataMono}`}
                >
                  {s < step ? (
                    <svg viewBox="0 0 12 10" fill="none" className="h-3.5 w-3.5">
                      <path
                        d="M1 5l3.5 3.5L11 1"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                {s < 2 && (
                  <div
                    className={`h-px w-12 transition-all ${
                      s < step ? "bg-marketing-accent/50" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Student details */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-6">
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-accent ${typo.dataMono}`}
                >
                  Step 1 of 2
                </span>
                <h1
                  className={`mt-2 text-3xl font-bold text-marketing-cream sm:text-4xl ${typo.headingSans}`}
                >
                  Your details
                </h1>
                <p className={`mt-2 text-marketing-cream/60 ${typo.secondarySans}`}>
                  Tell us a bit about yourself to personalise your experience.
                </p>
              </div>

              <div className="space-y-4 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="complete-first-name"
                      className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                    >
                      First name
                    </label>
                    <input
                      id="complete-first-name"
                      type="text"
                      required
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      disabled={isSubmitting}
                      className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-all focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="complete-last-name"
                      className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                    >
                      Last name
                    </label>
                    <input
                      id="complete-last-name"
                      type="text"
                      required
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      disabled={isSubmitting}
                      className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-all focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                  >
                    Email address
                  </label>
                  <div
                    className={`w-full rounded-xl border border-white/5 bg-white/3 px-4 py-3 text-marketing-cream/40 ${typo.secondarySans}`}
                  >
                    {email}
                  </div>
                  <p className={`text-xs text-marketing-cream/30 ${typo.secondarySans}`}>
                    Confirmed via email link
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="complete-phone"
                    className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                  >
                    Phone{" "}
                    <span className="text-marketing-cream/40">(optional)</span>
                  </label>
                  <PhoneInput
                    value={phone}
                    onChange={(value) => {
                      setPhone(value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="4xx xxx xxx"
                    disabled={isSubmitting}
                    error={phoneError ?? undefined}
                    countrySelectClassName={signupPhoneCountryClassName}
                    className={cn(signupPhoneInputClassName, typo.secondarySans)}
                  />
                </div>

                {error ? (
                  <p className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}>
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full rounded-full bg-marketing-accent py-3.5 text-base font-semibold text-marketing-charcoal transition-all hover:bg-marketing-accent/90 disabled:cursor-not-allowed disabled:opacity-50 ${typo.headingSans}`}
                >
                  {isSubmitting ? "Saving…" : "Next"}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Password */}
          {step === 2 && (
            <form onSubmit={handleStep2Next} className="space-y-6">
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-[0.2em] text-marketing-accent ${typo.dataMono}`}
                >
                  Step 2 of 2
                </span>
                <h1
                  className={`mt-2 text-3xl font-bold text-marketing-cream sm:text-4xl ${typo.headingSans}`}
                >
                  Set your password
                </h1>
                <p className={`mt-2 text-marketing-cream/60 ${typo.secondarySans}`}>
                  Choose a strong password to secure your account.
                </p>
              </div>

              <div className="space-y-4 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-sm">
                <div className="space-y-1.5">
                  <label
                    htmlFor="complete-password"
                    className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                  >
                    Password
                  </label>
                  <input
                    id="complete-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    disabled={isSubmitting}
                    className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-all focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="complete-confirm-password"
                    className={`block text-sm font-medium text-marketing-cream/80 ${typo.secondarySans}`}
                  >
                    Confirm password
                  </label>
                  <input
                    id="complete-confirm-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    disabled={isSubmitting}
                    className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-all focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
                  />
                </div>

                {error ? (
                  <p className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}>
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full rounded-full bg-marketing-accent py-3.5 text-base font-semibold text-marketing-charcoal transition-all hover:bg-marketing-accent/90 disabled:cursor-not-allowed disabled:opacity-50 ${typo.headingSans}`}
                >
                  {isSubmitting ? "Setting up…" : "Complete sign up"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep(1); setError(null); }}
                  className={`w-full text-sm text-marketing-cream/40 transition-colors hover:text-marketing-cream/70 ${typo.secondarySans}`}
                >
                  ← Back
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
