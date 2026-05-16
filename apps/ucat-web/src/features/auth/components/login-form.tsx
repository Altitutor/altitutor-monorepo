"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@altitutor/ui";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

export function LoginForm({
  redirectTo = "/dashboard",
}: {
  redirectTo?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
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
        "auth-entrance space-y-5 rounded-3xl border border-border/80 bg-card p-8 text-card-foreground shadow-sm backdrop-blur-sm",
        typo.secondarySans,
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-foreground/90">
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
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-foreground/90">
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
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
