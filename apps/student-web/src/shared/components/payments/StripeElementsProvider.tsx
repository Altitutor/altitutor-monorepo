"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { Elements } from "@stripe/react-stripe-js";
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js";

interface StripeElementsProviderProps {
  children: ReactNode;
  options: StripeElementsOptions;
}

type StripeLoadState =
  | { status: "loading"; stripe: null }
  | { status: "ready"; stripe: Stripe }
  | { status: "error"; stripe: null };

export function StripeElementsProvider({
  children,
  options,
}: StripeElementsProviderProps) {
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<StripeLoadState>({
    status: "loading",
    stripe: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadState({ status: "loading", stripe: null });

      try {
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) {
          throw new Error("Stripe publishable key is unavailable");
        }

        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(publishableKey);
        if (!stripe) {
          throw new Error("Stripe.js is unavailable");
        }

        if (!cancelled) {
          setLoadState({ status: "ready", stripe });
        }
      } catch {
        if (!cancelled) {
          setLoadState({ status: "error", stripe: null });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (loadState.status === "loading") {
    return (
      <div
        className="rounded-md border p-4 text-sm text-muted-foreground"
        aria-live="polite"
      >
        Loading secure payment form…
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div
        role="alert"
        aria-label="Payment form unavailable"
        className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
      >
        <div>
          <p className="font-medium text-destructive">
            Payment form unavailable
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We couldn&apos;t load the secure card form. Check your connection or
            content blocker, then try again. Your progress is still saved.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-accent"
          onClick={() => setAttempt((currentAttempt) => currentAttempt + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <Elements stripe={loadState.stripe} options={options}>
      {children}
    </Elements>
  );
}
