export const UCAT_APPLE_PRODUCTS = [
  { id: "com.altitutor.ucat.unlimited.weekly", interval: "week" },
  { id: "com.altitutor.ucat.unlimited.monthly", interval: "month" },
] as const;

export type UcatAppleBillingState = {
  configured: boolean;
  canPurchase: boolean;
  pendingAppleCheckout: boolean;
  provider: "apple" | "stripe" | "none";
  products: typeof UCAT_APPLE_PRODUCTS;
  apple: {
    status: number;
    accessUntil: string | null;
    environment: string;
  } | null;
};
