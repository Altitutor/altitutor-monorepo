"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { ContactDialog } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@altitutor/ui";
import { authApi } from "@/features/auth/api/auth";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;
const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordForm({
  initialError = null,
}: {
  initialError?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await authApi.requestPasswordReset(email.trim());
      setSuccess(true);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendPasswordReset() {
    if (resendCooldown > 0 || isSubmitting) return;

    setIsSubmitting(true);
    setResendError(null);
    setResendMessage(null);

    try {
      await authApi.requestPasswordReset(email.trim());
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendMessage("A new password reset email has been sent.");
    } catch (cause) {
      setResendError(
        cause instanceof Error
          ? cause.message
          : "We couldn't resend the email. Please try again shortly.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <>
        <div
          className={cn(
            "auth-feedback-entrance space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm",
            typo.secondarySans,
          )}
        >
          <div className="space-y-2 text-center">
            <h2
              className={cn(
                "text-2xl font-bold text-foreground",
                typo.headingSans,
              )}
            >
              Check your email
            </h2>
            <p className="text-sm text-muted-foreground">
              If an account exists with that email, we&apos;ve sent password
              reset instructions.
            </p>
          </div>
          <Button
            asChild
            className={cn(
              "auth-submit h-auto w-full rounded-full py-3.5 text-base font-semibold",
              typo.headingSans,
            )}
            size="lg"
          >
            <Link href="/login">Return to sign in</Link>
          </Button>
          <div className="space-y-2 text-center text-sm">
            <button
              type="button"
              onClick={() => void resendPasswordReset()}
              disabled={resendCooldown > 0 || isSubmitting}
              className="font-medium text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              {isSubmitting
                ? "Resending…"
                : resendCooldown > 0
                  ? `Resend email in ${resendCooldown}s`
                  : "Resend reset email"}
            </button>
            {resendMessage ? (
              <p
                className="auth-feedback-entrance text-muted-foreground"
                role="status"
              >
                {resendMessage}
              </p>
            ) : null}
            {resendError ? (
              <p
                className="auth-feedback-entrance text-destructive"
                role="alert"
              >
                {resendError}
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Is something wrong?{" "}
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Contact us
          </button>
        </p>
        <ContactDialog
          open={contactOpen}
          onOpenChange={setContactOpen}
          appName="ucat-web"
          user={{ email: email.trim() }}
          collectContactDetails
        />
      </>
    );
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className={cn(
          "space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm",
          typo.secondarySans,
        )}
      >
        <div className="space-y-1.5">
          <Label
            htmlFor="forgot-email"
            className="text-sm font-medium text-foreground/90"
          >
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
          <p
            className="auth-feedback-entrance rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "auth-submit h-auto w-full rounded-full py-3.5 text-base font-semibold",
            typo.headingSans,
          )}
          size="lg"
        >
          {isSubmitting ? "Sending…" : "Send reset instructions"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
}
