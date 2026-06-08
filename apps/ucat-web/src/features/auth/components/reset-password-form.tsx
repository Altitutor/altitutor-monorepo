"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@altitutor/ui";
import { authApi } from "@/features/auth/api/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionState, setSessionState] = useState<"loading" | "valid" | "invalid">("loading");

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError(
          "Invalid or expired reset session. Please request a new password reset.",
        );
        setSessionState("invalid");
        return;
      }

      setSessionState("valid");
    })();
  }, [supabase]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      await authApi.confirmPasswordReset(password);
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to reset password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sessionState === "loading") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-3xl border border-border/80 bg-card p-12 text-card-foreground shadow-sm",
          typo.secondarySans,
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Validating reset link…</p>
      </div>
    );
  }

  if (sessionState === "invalid") {
    return (
      <div
        className={cn(
          "space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm backdrop-blur-sm",
          typo.secondarySans,
        )}
      >
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error ??
            "Invalid or expired reset session. Please request a new password reset."}
        </p>
        <Button
          asChild
          className={cn(
            "h-auto w-full rounded-full py-3.5 text-base font-semibold",
            typo.headingSans,
          )}
          size="lg"
        >
          <Link href="/forgot-password">Request new reset</Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
          >
            Back to sign in
          </Link>
        </p>
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
        <Label htmlFor="new-password" className="text-sm font-medium text-foreground/90">
          New password
        </Label>
        <Input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          className="h-auto min-h-[48px] rounded-xl border-border px-4 py-3 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground/90">
          Confirm password
        </Label>
        <Input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
        {isSubmitting ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
