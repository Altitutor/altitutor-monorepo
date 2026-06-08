"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@altitutor/ui";
import { authApi } from "@/features/auth/api/auth";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

export function ForgotPasswordForm({ initialError = null }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await authApi.requestPasswordReset(email.trim());
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div
        className={cn(
          "space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm backdrop-blur-sm",
          typo.secondarySans,
        )}
      >
        <div className="space-y-2 text-center">
          <h2 className={cn("text-2xl font-bold text-foreground", typo.headingSans)}>
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground">
            If an account exists with that email, we&apos;ve sent password reset instructions.
          </p>
        </div>
        <Button
          asChild
          className={cn(
            "h-auto w-full rounded-full py-3.5 text-base font-semibold",
            typo.headingSans,
          )}
          size="lg"
        >
          <Link href="/login">Return to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm backdrop-blur-sm",
        typo.secondarySans,
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email" className="text-sm font-medium text-foreground/90">
          Email address
        </Label>
        <Input
          id="forgot-email"
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
      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "h-auto w-full rounded-full py-3.5 text-base font-semibold",
          typo.headingSans,
        )}
        size="lg"
      >
        {isSubmitting ? "Sending…" : "Send reset instructions"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
