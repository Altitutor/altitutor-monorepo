"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MARKETING_TOKENS } from "@altitutor/shared";
import type { Database } from "@altitutor/shared";
import { ChevronLeft } from "lucide-react";
import { PROFILE_SETUP_COMPLETE_KEY } from "@/features/auth/lib/signup-profile";
import { UCAT_ACCENT_FILL_RISE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

type SignupCompletePasswordStepProps = {
  supabase: SupabaseClient<Database>;
  onComplete: () => void;
  onBack: () => void;
  error: string | null;
  setError: (value: string | null) => void;
};

export function SignupCompletePasswordStep({
  supabase,
  onComplete,
  onBack,
  error,
  setError,
}: SignupCompletePasswordStepProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitInFlightRef.current) return;

    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { [PROFILE_SETUP_COMPLETE_KEY]: true },
      });
      if (updateError) {
        setError(updateError.message ?? "Failed to set password.");
        submitInFlightRef.current = false;
        setIsSubmitting(false);
        return;
      }

      onComplete();
      // Leave isSubmitting true so Next stays locked during the step transition.
    } catch {
      setError("Something went wrong. Please try again.");
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10 backdrop-blur-sm"
    >
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
          className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-[border-color,box-shadow] duration-200 focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
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
          className={`w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-marketing-cream placeholder-marketing-cream/30 outline-none transition-[border-color,box-shadow] duration-200 focus:border-marketing-accent/50 focus:ring-2 focus:ring-marketing-accent/20 disabled:opacity-50 ${typo.secondarySans}`}
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
        className={cn(
          UCAT_ACCENT_FILL_RISE,
          "w-full rounded-full bg-marketing-accent py-3.5 text-base font-semibold text-marketing-charcoal disabled:cursor-not-allowed disabled:opacity-50",
          typo.headingSans,
        )}
      >
        {isSubmitting ? "Setting up…" : "Next"}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={isSubmitting}
        className={`inline-flex w-full items-center justify-center gap-1 text-sm text-marketing-cream/40 transition-colors hover:text-marketing-cream/70 disabled:cursor-not-allowed disabled:opacity-50 ${typo.secondarySans}`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back
      </button>
    </form>
  );
}
