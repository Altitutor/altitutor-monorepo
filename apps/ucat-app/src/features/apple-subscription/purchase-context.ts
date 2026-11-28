import { createContext, use } from "react";
import type { UcatAppleBillingState } from "@altitutor/shared";
export type ApplePurchases = {
  supported: boolean;
  connected: boolean;
  busy: boolean;
  loadingProducts: boolean;
  refresh: () => Promise<void>;
  state?: UcatAppleBillingState;
  error: string | null;
  products: { id: string; displayPrice: string }[];
  buy: (productId: string) => Promise<void>;
  restore: () => Promise<void>;
  manage: () => Promise<void>;
  clearCancelledCheckout: () => Promise<void>;
};
const unavailable = async () => {
  throw new Error("Purchases are available in the installed iOS app.");
};
export const ApplePurchaseContext = createContext<ApplePurchases>({
  supported: false,
  connected: false,
  busy: false,
  loadingProducts: false,
  refresh: unavailable,
  error: null,
  products: [],
  buy: unavailable,
  restore: unavailable,
  manage: unavailable,
  clearCancelledCheckout: unavailable,
});
export const useApplePurchases = () => use(ApplePurchaseContext);
