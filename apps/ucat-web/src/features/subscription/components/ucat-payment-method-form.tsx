"use client";

import { useState } from "react";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Check, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyUcatPaymentMethod } from "@/features/subscription/api/ucat-payment-method";
import { UCAT_PRIMARY_ACTION_BUTTON } from "@/lib/ucat-surface-motion";

type UcatPaymentMethodFormProps = {
  onCancel: () => void;
  onSuccess: () => void;
};

export function UcatPaymentMethodForm({
  onCancel,
  onSuccess,
}: UcatPaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const returnUrl = new URL(
        "/settings/plan/subscription",
        window.location.origin,
      );
      returnUrl.searchParams.set("payment_method", "return");

      const { error: setupError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: returnUrl.toString() },
        redirect: "if_required",
      });

      if (setupError) {
        throw new Error(setupError.message ?? "Stripe could not verify this card");
      }
      if (!setupIntent || setupIntent.status !== "succeeded") {
        throw new Error("Stripe could not finish saving this card");
      }

      const result = await applyUcatPaymentMethod(setupIntent.id);
      if (!result.paymentMethod) {
        throw new Error("The saved card could not be verified");
      }
      onSuccess();
    } catch (submissionError: unknown) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to update payment method",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <PaymentElement
        options={{
          layout: "tabs",
          business: { name: "Altitutor" },
          wallets: {
            applePay: "never",
            googlePay: "never",
            link: "never",
          },
        }}
      />

      <div className="rounded-ucatControl bg-muted/45 px-4 py-3">
        <div className="flex gap-3">
          <LockKeyhole
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Stripe securely saves this card for future UCAT subscription bills.
            Altitutor never receives or stores your card number or security code.
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className={UCAT_PRIMARY_ACTION_BUTTON}
          disabled={!stripe || !elements || submitting}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          {submitting ? "Saving card…" : "Use this card"}
        </Button>
      </div>
    </form>
  );
}
