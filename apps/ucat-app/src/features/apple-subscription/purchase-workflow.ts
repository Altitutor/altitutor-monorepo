import { UCAT_APPLE_PRODUCTS } from "@altitutor/shared";

export type ApplePurchaseIdentity = {
  id: string;
  productId: string;
  purchaseState: string;
  storeId: string;
  environmentIOS?: string | null;
};

/** Finishing removes the transaction from StoreKit's retry queue: verify first. */
export async function settleApplePurchase<
  T extends ApplePurchaseIdentity,
  Result,
>(input: {
  purchase: T;
  userId: string;
  currentUserId: () => string | undefined | null;
  verify: (
    transactionId: string,
    environment: "Production" | "Sandbox",
  ) => Promise<Result>;
  finish: (purchase: T) => Promise<void>;
}): Promise<Result> {
  if (input.currentUserId() !== input.userId)
    throw new Error("Sign in to the account that owns this purchase.");
  const p = input.purchase;
  if (
    p.storeId !== "apple" ||
    p.purchaseState !== "purchased" ||
    !/^\d+$/.test(p.id) ||
    !UCAT_APPLE_PRODUCTS.some((product) => product.id === p.productId)
  )
    throw new Error("Purchase is not ready for verification.");
  const environment = p.environmentIOS;
  if (environment !== "Production" && environment !== "Sandbox")
    throw new Error(
      "Apple purchase environment is unavailable. Please restore purchases.",
    );
  const result = await input.verify(p.id, environment);
  if (input.currentUserId() !== input.userId)
    throw new Error(
      "Your account changed. Sign back in and restore purchases.",
    );
  await input.finish(p);
  return result;
}

/** Preparation can cross an auth transition; bind the payment sheet to its initiator. */
export async function launchBoundApplePurchase(input: {
  userId: string;
  currentUserId: () => string | undefined | null;
  prepare: () => Promise<{ accountToken: string }>;
  request: (accountToken: string) => Promise<unknown>;
}): Promise<void> {
  if (input.currentUserId() !== input.userId)
    throw new Error("Sign in to the account starting this purchase.");
  const { accountToken } = await input.prepare();
  if (input.currentUserId() !== input.userId)
    throw new Error(
      "Your account changed. Start the purchase again after signing in.",
    );
  await input.request(accountToken);
}
