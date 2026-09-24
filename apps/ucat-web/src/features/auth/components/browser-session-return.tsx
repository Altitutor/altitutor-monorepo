"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export function BrowserSessionReturn() {
  const started = useRef(false);
  const ticket = useRef<string | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exchange = useCallback(async (confirmed = false) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!ticket.current)
        throw new Error(
          "This link has expired. Close this browser and open the page again from the app.",
        );
      const response = await fetch("/api/auth/browser/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ ticket: ticket.current, confirmed }),
      });
      const data: {
        path?: string;
        confirmationRequired?: boolean;
        email?: string;
      } = await response.json();
      if (response.ok && data.confirmationRequired && data.email) {
        setEmail(data.email);
        return;
      }
      if (
        !response.ok ||
        !data.path ||
        ![
          "/exam",
          "/settings/profile",
          "/settings/plan",
          "/settings/plan/subscription",
          "/settings/plan/referrals",
        ].includes(data.path)
      )
        throw new Error(
          "Unable to open your account. Close this browser and try again from the app.",
        );
      ticket.current = null;
      window.location.replace(data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open your account.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ticket.current = new URLSearchParams(window.location.hash.slice(1)).get(
      "ticket",
    );
    window.history.replaceState(null, "", window.location.pathname);
    void exchange();
  }, [exchange]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <section className="max-w-md space-y-4 rounded-3xl border bg-card p-8 text-card-foreground">
        <p className="text-sm font-medium text-muted-foreground">
          ALTITUTOR UCAT
        </p>
        <h1 className="text-2xl font-semibold">
          {error
            ? "Please try again"
            : email
              ? "Continue with your account"
              : "Opening your account…"}
        </h1>
        <p role={error ? "alert" : "status"} className="text-muted-foreground">
          {error ??
            (email
              ? `You’re opening this page as ${email}.`
              : "Signing you in securely from the app.")}
        </p>
        {email && !error && (
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => void exchange(true)}
          >
            {busy ? "Opening…" : "Continue"}
          </Button>
        )}
      </section>
    </main>
  );
}
