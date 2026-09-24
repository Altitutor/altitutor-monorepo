"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MARKETING_TOKENS } from "@altitutor/shared";
import type { Database } from "@altitutor/shared";
import { ChevronLeft } from "lucide-react";
import { PROFILE_SETUP_COMPLETE_KEY } from "@/features/auth/lib/signup-profile";
import { UCAT_SIGNUP_PRIMARY_ACTION } from "@/lib/ucat-surface-motion";
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
      className="space-y-4 rounded-3xl bg-card/80 p-8 shadow-sm ring-1 ring-border backdrop-blur-sm"
    >
      <div className="space-y-1.5">
        <label
          htmlFor="complete-password"
          className={`block text-sm font-medium text-foreground ${typo.secondarySans}`}
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
          className={`w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:focus:border-accent/50 dark:focus:ring-accent/20 ${typo.secondarySans}`}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="complete-confirm-password"
          className={`block text-sm font-medium text-foreground ${typo.secondarySans}`}
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
          className={`w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground placeholder:text-muted-foreground/60 outline-none transition-[border-color,box-shadow] duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:focus:border-accent/50 dark:focus:ring-accent/20 ${typo.secondarySans}`}
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
        className={cn(UCAT_SIGNUP_PRIMARY_ACTION, typo.headingSans)}
      >
        {isSubmitting ? "Setting up…" : "Next"}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={isSubmitting}
        className={`inline-flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${typo.secondarySans}`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back
      </button>
    </form>
  );
}
