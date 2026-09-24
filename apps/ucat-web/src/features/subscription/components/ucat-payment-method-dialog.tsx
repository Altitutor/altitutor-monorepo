"use client";

import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useTheme } from "next-themes";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@altitutor/ui";
import { createUcatPaymentMethodSetup } from "@/features/subscription/api/ucat-payment-method";
import { UcatPaymentMethodForm } from "@/features/subscription/components/ucat-payment-method-form";

const publishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);

type UcatPaymentMethodDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function UcatPaymentMethodDialog({
  open,
  onOpenChange,
  onSuccess,
}: UcatPaymentMethodDialogProps) {
  const { resolvedTheme } = useTheme();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    void createUcatPaymentMethodSetup()
      .then((result) => {
        if (active) setClientSecret(result.clientSecret);
      })
      .catch((setupError: unknown) => {
        if (!active) return;
        setError(
          setupError instanceof Error
            ? setupError.message
            : "Failed to prepare card update",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.12] via-background to-accent/[0.12] px-6 py-6">
          <DialogHeader className="text-left">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm dark:bg-accent dark:text-primary-foreground">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl">Change your UCAT card</DialogTitle>
            <DialogDescription className="leading-relaxed">
              This card will be used for future UCAT subscription bills.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-6">
          {!publishableKey ? (
            <p role="alert" className="text-sm text-destructive">
              Stripe is not configured in this environment.
            </p>
          ) : loading ? (
            <div
              className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Preparing secure card fields…
            </div>
          ) : error ? (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                No card details were submitted.
              </p>
            </div>
          ) : clientSecret ? (
            <Elements
              key={clientSecret}
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: resolvedTheme === "light" ? "stripe" : "night",
                  variables: {
                    colorPrimary: "#91b4c5",
                    colorBackground:
                      resolvedTheme === "light" ? "#ffffff" : "#262626",
                    colorText:
                      resolvedTheme === "light" ? "#072348" : "#ffffff",
                    colorDanger: "#dc2626",
                    colorTextSecondary:
                      resolvedTheme === "light" ? "#36516f" : "#b3b3b3",
                    borderRadius: "16px",
                    fontFamily:
                      "Inter, ui-sans-serif, system-ui, sans-serif",
                  },
                  rules: {
                    ".AccordionItem": {
                      backgroundColor: "transparent",
                      border: "1px solid transparent",
                      boxShadow: "none",
                      padding: "0",
                    },
                    ".Input": {
                      backgroundColor:
                        resolvedTheme === "light" ? "#ffffff" : "#262626",
                      borderColor:
                        resolvedTheme === "light" ? "#dfe1e5" : "#3d3d3d",
                      boxShadow: "none",
                      padding: "14px",
                    },
                    ".Input:focus": {
                      borderColor: "#91b4c5",
                      boxShadow: "0 0 0 2px rgba(145, 180, 197, 0.18)",
                    },
                    ".Label": { fontWeight: "500" },
                  },
                },
              }}
            >
              <UcatPaymentMethodForm
                onCancel={() => onOpenChange(false)}
                onSuccess={handleSuccess}
              />
            </Elements>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
