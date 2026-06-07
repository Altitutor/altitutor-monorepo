import type { UcatBillingInterval } from "@altitutor/shared";

export type UcatUpgradePreview = {
  currency: string;
  billingInterval: UcatBillingInterval;
  billingIntervalNoun: string;
  isTrialing: boolean;
  dueTodayCents: number;
  renewalStandardCents: number;
  currentPeriodEnd: string | null;
};

export async function fetchUcatUpgradePreview(): Promise<UcatUpgradePreview> {
  const res = await fetch("/api/ucat/subscription/upgrade-preview", {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string })?.error ?? res.statusText;
    throw new Error(message);
  }

  return (await res.json()) as UcatUpgradePreview;
}
