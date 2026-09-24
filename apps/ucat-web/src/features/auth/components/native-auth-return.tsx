"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const finish = useCallback(async () => {
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
      lock.current = false;
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }, [callback, challenge, state]);
  useEffect(() => {
    void finish();
  }, [finish]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <section className="w-full max-w-md space-y-6 rounded-3xl border bg-card p-8 text-card-foreground shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">
          ALTITUTOR UCAT
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Opening the UCAT app
        </h1>
        <p className="text-muted-foreground">
          Signing you in as{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {busy && <p role="status">Returning to the app…</p>}
        {error && (
          <Button
            className="w-full"
            disabled={busy}
            onClick={() => void finish()}
          >
            Try again
          </Button>
        )}
        {returnUrl && (
          <a className="block text-center text-sm underline" href={returnUrl}>
            Open the app again
          </a>
        )}
      </section>
    </main>
  );
}
