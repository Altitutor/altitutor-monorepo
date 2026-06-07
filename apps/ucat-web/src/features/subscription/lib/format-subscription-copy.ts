import type { UcatBillingInterval } from "@altitutor/shared";

export function formatMoneyFromMinorUnits(
  amountCents: number,
  currencyCode: string,
  options?: { omitAudPrefix?: boolean },
): string {
  const code = currencyCode.toUpperCase();
  const amount = (amountCents / 100).toFixed(2);

  if (code === "AUD") {
    return options?.omitAudPrefix ? `$${amount}` : `A$${amount}`;
  }
  if (code === "USD") return `$${amount}`;

  return `${code} ${amount}`;
}

export function isAustralianTimezone(timezone: string | null | undefined): boolean {
  return Boolean(timezone?.startsWith("Australia/"));
}

export function billingIntervalNoun(interval: UcatBillingInterval): string {
  switch (interval) {
    case "week":
      return "week";
    case "month":
      return "month";
    case "year":
      return "year";
  }
}
