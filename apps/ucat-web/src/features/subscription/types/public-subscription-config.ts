export type PublicUcatSubscriptionConfig = {
  trialDays: number;
  minQuestionsPerDay: number;
  discountPerDayCents: number;
  basePriceCents: number;
  currency: string;
  billingInterval: "week" | "fortnight" | "month";
};

/** Fallback when the public API is unavailable */
export const defaultPublicSubscriptionConfig: PublicUcatSubscriptionConfig = {
  trialDays: 7,
  minQuestionsPerDay: 20,
  discountPerDayCents: 1000,
  basePriceCents: 7500,
  currency: "aud",
  billingInterval: "week",
};
