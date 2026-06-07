import type { UcatPaidPlanTier } from "@altitutor/shared";

export async function changeUcatSubscriptionTier(input: {
  tier: UcatPaidPlanTier;
}): Promise<{ tier: UcatPaidPlanTier; billingInterval: string }> {
  const res = await fetch("/api/ucat/subscription/change-tier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string })?.error ?? res.statusText;
    throw new Error(message);
  }

  return (await res.json()) as { tier: UcatPaidPlanTier; billingInterval: string };
}
