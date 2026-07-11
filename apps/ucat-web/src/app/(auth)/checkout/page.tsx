import { Suspense } from "react";
import { CheckoutPage } from "@/features/subscription/components/checkout/checkout-page";

export default function CheckoutRoute() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-marketing-charcoal" />}>
      <CheckoutPage />
    </Suspense>
  );
}
