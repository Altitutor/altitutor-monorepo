"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ExpressCheckoutElement,
  PaymentElement,
  useCheckout,
} from "@stripe/react-stripe-js/checkout";
import { trackSubscriptionJourneyEvent } from "@/features/subscription/api/track-subscription-journey";
import type { UcatBillingInterval, UcatPaidPlanTier } from "@altitutor/shared";

type CheckoutPaymentFormProps = {
  tier: UcatPaidPlanTier;
  interval: UcatBillingInterval;
  context:
    | "signup_onboarding"
    | "subscribe"
    | "practice_session"
    | "referral_gift";
  checkoutSessionId: string | null;
  onReadyChange?: (ready: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
};

export function CheckoutPaymentForm({
  tier,
  interval,
  context,
  checkoutSessionId,
  onSubmittingChange,
  onReadyChange,
}: CheckoutPaymentFormProps) {
  const checkoutState = useCheckout();
  const [paymentReady, setPaymentReady] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    onReadyChange?.(checkoutState.type === "success" && paymentReady);
    return () => onReadyChange?.(false);
  }, [checkoutState.type, paymentReady, onReadyChange]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExpressPaymentMethod, setHasExpressPaymentMethod] = useState(false);

  if (checkoutState.type === "loading") {
    return (
      <div
        className="animate-pulse space-y-5"
        aria-label="Loading payment fields"
      >
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-12 rounded-xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 rounded-xl bg-muted" />
          <div className="h-12 rounded-xl bg-muted" />
        </div>
        <div className="h-12 rounded-xl bg-muted" />
      </div>
    );
  }
  if (checkoutState.type === "error") {
    return (
      <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-200">
        {checkoutState.error.message}
      </p>
    );
  }

  const { checkout } = checkoutState;
  const trackSubmission = () => {
    trackSubscriptionJourneyEvent({
      eventType: "payment_submitted",
      journeyContext: context,
      planTier: tier,
      billingInterval: interval,
      checkoutSessionId: checkoutSessionId ?? undefined,
    });
  };
  const handleError = (message: string) => {
    inFlight.current = false;
    setSubmitting(false);
    onSubmittingChange?.(false);
    setError(message);
    trackSubscriptionJourneyEvent({
      eventType: "checkout_failed",
      journeyContext: context,
      planTier: tier,
      billingInterval: interval,
      checkoutSessionId: checkoutSessionId ?? undefined,
      metadata: { message: message.slice(0, 160) },
    });
  };

  const submit = async () => {
    if (!paymentReady || inFlight.current || submitting) return;
    inFlight.current = true;
    setSubmitting(true);
    onSubmittingChange?.(true);
    setError(null);
    trackSubmission();
    try {
      const result = await checkout.confirm({ redirect: "always" });
      if (result.type === "error") handleError(result.error.message);
    } catch (reason) {
      handleError(
        reason instanceof Error
          ? reason.message
          : "Payment could not be confirmed. Please try again.",
      );
    }
  };

  return (
    <form
      id="ucat-checkout-payment-form"
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ExpressCheckoutElement
        options={{
          buttonHeight: 48,
          buttonTheme: {},
          buttonType: {
            applePay: "subscribe",
            googlePay: "subscribe",
          },
          layout: { maxColumns: 1, maxRows: 2, overflow: "never" },
          paymentMethodOrder: ["apple_pay", "google_pay"],
          paymentMethods: {
            applePay: "always",
            googlePay: "always",
            link: "never",
          },
        }}
        onReady={(event) => {
          setHasExpressPaymentMethod(
            Object.keys(event.availablePaymentMethods ?? {}).length > 0,
          );
        }}
        onConfirm={(event) => {
          if (inFlight.current) return;
          inFlight.current = true;
          setSubmitting(true);
          onSubmittingChange?.(true);
          trackSubmission();
          void checkout
            .confirm({
              redirect: "always",
              expressCheckoutConfirmEvent: event,
            })
            .then((result) => {
              if (result.type === "error") handleError(result.error.message);
            })
            .catch((reason: unknown) =>
              handleError(
                reason instanceof Error
                  ? reason.message
                  : "Payment could not be confirmed. Please try again.",
              ),
            );
        }}
      />
      {hasExpressPaymentMethod ? (
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          Or pay by card
          <span className="h-px flex-1 bg-border" />
        </div>
      ) : null}
      <PaymentElement
        onReady={() => setPaymentReady(true)}
        onLoadError={() => {
          setPaymentReady(false);
          handleError(
            "Payment fields could not load. Please refresh and try again.",
          );
        }}
        options={{
          layout: "accordion",
          fields: {
            billingDetails: {
              name: "never",
              email: "never",
              phone: "never",
              address: "if_required",
            },
          },
        }}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
