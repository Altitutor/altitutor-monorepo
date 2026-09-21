"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export function NativeAuthReturn({
  callback,
  state,
  challenge,
  email,
}: {
  callback: string;
  state: string;
  challenge: string;
  email: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  async function finish() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/native/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ challenge }),
      });
      const data: { ticket?: string } = await response.json();
      if (!response.ok || !data.ticket)
        throw new Error(
          "Unable to finish signing in. Please return to the app and try again.",
        );
      const destination = new URL(callback);
      destination.hash = new URLSearchParams({
        ticket: data.ticket,
        state,
      }).toString();
      setReturnUrl(destination.toString());
      window.location.assign(destination.toString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-8 text-card-foreground shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          ALTITUTOR UCAT
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Ready to continue
        </h1>
        <p className="text-muted-foreground">
          Continue to the UCAT app as{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => void finish()}
        >
          {busy ? "Opening the app…" : "Continue to app"}
        </Button>
        {returnUrl && (
          <a className="block text-center text-sm underline" href={returnUrl}>
            Open the app again
          </a>
        )}
      </section>
    </main>
  );
}
