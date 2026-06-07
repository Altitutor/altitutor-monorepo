"use client";

import { useState } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  PhoneInput,
  isPhoneCountryCodeOnly,
  validateOptionalPhoneE164,
} from "@altitutor/ui";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

const signupPhoneInputClassName = cn(
  "[&_.PhoneInputInput]:h-12 [&_.PhoneInputInput]:rounded-xl [&_.PhoneInputInput]:border-white/10 [&_.PhoneInputInput]:bg-white/5 [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:text-marketing-cream [&_.PhoneInputInput]:placeholder:text-marketing-cream/30 [&_.PhoneInputInput]:focus-visible:border-marketing-accent/50 [&_.PhoneInputInput]:focus-visible:ring-marketing-accent/20",
  "[&>p:last-child]:text-marketing-cream/30",
);

const signupPhoneCountryClassName = cn(
  "[&_button]:h-12 [&_button]:rounded-xl [&_button]:border-white/10 [&_button]:bg-white/5 [&_button]:text-marketing-cream [&_button]:focus-visible:ring-marketing-accent/20",
);

type SignupCompleteDetailsStepProps = {
  email: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
  onComplete: () => void;
  error: string | null;
  setError: (value: string | null) => void;
};

export function SignupCompleteDetailsStep({
  email,
  initialFirstName,
  initialLastName,
  initialPhone,
  onComplete,
  error,
  setError,
}: SignupCompleteDetailsStepProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPhoneError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    const phoneResult = validateOptionalPhoneE164(phone);
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

      onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-sm">
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
            className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-[border-color,box-shadow] duration-200 focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
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
            className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-[border-color,box-shadow] duration-200 focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
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
          Phone <span className="text-marketing-cream/40">(optional)</span>
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
        className={`w-full rounded-full bg-marketing-accent py-3.5 text-base font-semibold text-marketing-charcoal transition-colors duration-200 hover:bg-marketing-accent/90 disabled:cursor-not-allowed disabled:opacity-50 ${typo.headingSans}`}
      >
        {isSubmitting ? "Saving…" : "Next"}
      </button>
    </form>
  );
}
