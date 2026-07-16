"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@altitutor/ui";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

export function LoginForm({
  redirectTo = "/dashboard",
  initialEmail = "",
  accountExists = false,
  resetSuccess = false,
}: {
  redirectTo?: string;
  initialEmail?: string;
  accountExists?: boolean;
  resetSuccess?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm",
        typo.secondarySans,
      )}
    >
      {accountExists ? (
        <p
          className="auth-feedback-entrance rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          An account with this email already exists. Sign in below.
        </p>
      ) : null}
      {resetSuccess ? (
        <p
          className="auth-feedback-entrance rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Your password has been reset. You can now sign in with your new
          password.
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-sm font-medium text-foreground/90"
        >
          Email address
        </Label>
        <Input
          id="email"
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
      {/* Grid places Forgot password beside the label visually while DOM
          order keeps tab as: password → sign in → forgot password. */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5">
        <Label
          htmlFor="password"
          className="col-start-1 row-start-1 text-sm font-medium text-foreground/90"
        >
          Password
        </Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          className="col-span-2 row-start-2 h-auto min-h-[48px] rounded-xl border-border px-4 py-3 text-base"
        />
        <div className="col-span-2 row-start-3 mt-3.5 space-y-5">
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
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </div>
        <Link
          href="/forgot-password"
          className="col-start-2 row-start-1 text-sm font-medium text-primary underline-offset-2 transition-colors hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
