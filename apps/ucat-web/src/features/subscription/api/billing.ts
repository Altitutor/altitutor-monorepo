import type { UcatSubscriptionBillingResponse } from "@/features/subscription/types/ucat-subscription-billing";

export async function fetchUcatSubscriptionBilling(): Promise<UcatSubscriptionBillingResponse> {
  const response = await fetch("/api/ucat/subscription/billing", {
    method: "GET",
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error ?? `Failed to load subscription billing (${response.status})`,
    );
  }

  return (await response.json()) as UcatSubscriptionBillingResponse;
}
