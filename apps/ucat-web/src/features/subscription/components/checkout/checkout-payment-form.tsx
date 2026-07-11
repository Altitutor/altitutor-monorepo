"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import {
  ExpressCheckoutElement,
  PaymentElement,
  useCheckout,
} from "@stripe/react-stripe-js/checkout";
import { Button } from "@/components/ui/button";
import { trackSubscriptionJourneyEvent } from "@/features/subscription/api/track-subscription-journey";
import type { UcatBillingInterval, UcatPaidPlanTier } from "@altitutor/shared";

type CheckoutPaymentFormProps = {
  tier: UcatPaidPlanTier;
  interval: UcatBillingInterval;
  context: "signup_onboarding" | "subscribe" | "practice_session";
  checkoutSessionId: string | null;
  onSubmittingChange?: (submitting: boolean) => void;
};

export function CheckoutPaymentForm({
  tier,
  interval,
  context,
  checkoutSessionId,
  onSubmittingChange,
}: CheckoutPaymentFormProps) {
  const checkoutState = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null);
  const [applyingPromotion, setApplyingPromotion] = useState(false);
  const [hasExpressPaymentMethod, setHasExpressPaymentMethod] = useState(false);

  if (checkoutState.type === "loading") {
    return <div className="h-64 animate-pulse rounded-2xl bg-white/5" />;
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
    if (submitting) return;
    setSubmitting(true);
    onSubmittingChange?.(true);
    setError(null);
    trackSubmission();
    const result = await checkout.confirm({ redirect: "always" });
    if (result.type === "error") handleError(result.error.message);
  };

  const applyPromotionCode = async () => {
    const code = promotionCode.trim();
    if (!code) return;
    setApplyingPromotion(true);
    setPromotionMessage(null);
    const result = await checkout.applyPromotionCode(code);
    setApplyingPromotion(false);
    setPromotionMessage(
      result.type === "success"
        ? "Promotion code applied. Stripe will include it in your final total."
        : result.error.message,
    );
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
            });
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
      <div className="space-y-2">
        <label
          htmlFor="promotion-code"
          className="text-sm font-medium text-foreground"
        >
          Promotion code{" "}
          <span className="font-normal text-muted-foreground">
            (optional)
          </span>
        </label>
        <div className="flex gap-2">
          <input
            id="promotion-code"
            value={promotionCode}
            onChange={(event) => setPromotionCode(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
            placeholder="Enter code"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            disabled={applyingPromotion || !promotionCode.trim()}
            onClick={() => void applyPromotionCode()}
            className="border-input bg-card text-foreground hover:bg-muted hover:text-foreground"
          >
            {applyingPromotion ? "Applying…" : "Apply"}
          </Button>
        </div>
        {promotionMessage ? (
          <p className="text-xs text-muted-foreground">{promotionMessage}</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <LockKeyhole className="h-3.5 w-3.5" /> Cancel anytime. Secure payment
        powered by Stripe.
      </p>
    </form>
  );
}
