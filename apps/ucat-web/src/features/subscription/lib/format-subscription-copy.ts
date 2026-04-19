import type { PublicUcatSubscriptionConfig } from "@/features/subscription/types/public-subscription-config";

export function formatMoneyFromMinorUnits(
  amountCents: number,
  currencyCode: string,
): string {
  const code = currencyCode.toUpperCase();
  const amount = (amountCents / 100).toFixed(2);

  // Keep server/client rendering deterministic to avoid hydration mismatches
  // caused by runtime locale differences (e.g. "A$75.00" vs "$75.00").
  if (code === "AUD") return `A$${amount}`;
  if (code === "USD") return `$${amount}`;

  return `${code} ${amount}`;
}

export function billingIntervalLabel(
  interval: PublicUcatSubscriptionConfig["billingInterval"],
): string {
  switch (interval) {
    case "week":
      return "Weekly";
    case "fortnight":
      return "Fortnightly";
    case "month":
      return "Monthly";
    default:
      return "Weekly";
  }
}

export function billingIntervalNoun(
  interval: PublicUcatSubscriptionConfig["billingInterval"],
): string {
  switch (interval) {
    case "week":
      return "week";
    case "fortnight":
      return "fortnight";
    case "month":
      return "month";
    default:
      return "week";
  }
}
