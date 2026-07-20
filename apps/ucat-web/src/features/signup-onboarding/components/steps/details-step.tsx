"use client";

import { useState } from "react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  PhoneInput,
  isPhoneCountryCodeOnly,
  validateOptionalPhoneE164,
} from "@altitutor/ui";
import { cn } from "@/lib/utils";
import { UCAT_ACCENT_FILL_RISE } from "@/lib/ucat-surface-motion";

const { typography: typo } = MARKETING_TOKENS;

const signupPhoneInputClassName = cn(
  "[&_.PhoneInputInput]:h-12 [&_.PhoneInputInput]:rounded-xl [&_.PhoneInputInput]:border-border [&_.PhoneInputInput]:bg-background/70 [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:text-foreground [&_.PhoneInputInput]:placeholder:text-muted-foreground/60 [&_.PhoneInputInput]:focus-visible:border-primary/50 [&_.PhoneInputInput]:focus-visible:ring-primary/20",
  "[&>p:last-child]:text-muted-foreground",
);

const signupPhoneCountryClassName = cn(
  "[&_button]:h-12 [&_button]:rounded-xl [&_button]:border-border [&_button]:bg-background/70 [&_button]:text-foreground [&_button]:focus-visible:ring-primary/20",
);

type SignupCompleteDetailsStepProps = {
  email: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
  onComplete: (details: {
    firstName: string;
    lastName: string;
    phone: string;
  }) => void;
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
      timezone?: string;
    } = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };

    const detectedTimezone = Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone?.trim();
    if (detectedTimezone) {
      payload.timezone = detectedTimezone;
    }

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

      onComplete({
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: phoneResult.phone ?? "",
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl bg-card/80 p-8 shadow-sm ring-1 ring-border backdrop-blur-sm"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label
            htmlFor="complete-first-name"
            className={`block text-sm font-medium text-foreground ${typo.secondarySans}`}
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
            className={`w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:focus:border-accent/50 dark:focus:ring-accent/20 ${typo.secondarySans}`}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="complete-last-name"
            className={`block text-sm font-medium text-foreground ${typo.secondarySans}`}
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
            className={`w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:focus:border-accent/50 dark:focus:ring-accent/20 ${typo.secondarySans}`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          className={`block text-sm font-medium text-foreground ${typo.secondarySans}`}
        >
          Email address
        </label>
        <div
          className={`w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-muted-foreground ${typo.secondarySans}`}
        >
          {email}
        </div>
        <p className={`text-xs text-muted-foreground ${typo.secondarySans}`}>
          Confirmed via email link
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="complete-phone"
          className={`block text-sm font-medium text-foreground ${typo.secondarySans}`}
        >
          Phone <span className="text-muted-foreground">(optional)</span>
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
        <p
          className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 ${typo.secondarySans}`}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(UCAT_ACCENT_FILL_RISE, "w-full", typo.headingSans)}
      >
        {isSubmitting ? "Saving…" : "Next"}
      </button>
    </form>
  );
}
