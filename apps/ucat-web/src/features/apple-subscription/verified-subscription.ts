/** Only accepts data already verified by Apple's SignedDataVerifier. Never decode client JWTs here. */
export type VerifiedAppleTransaction = {
  originalTransactionId?: string;
  transactionId?: string;
  productId?: string;
  appAccountToken?: string;
  bundleId?: string;
  environment?: string;
  expiresDate?: number;
  signedDate?: number;
  revocationDate?: number;
  type?: string;
};

export const APPLE_UNLIMITED_PRODUCTS = {
  "com.altitutor.ucat.unlimited.weekly": "week",
  "com.altitutor.ucat.unlimited.monthly": "month",
} as const;

export type AppleSubscriptionSnapshot = {
  originalTransactionId: string;
  transactionId: string;
  productId: string;
  accountToken: string;
  environment: "Production" | "Sandbox";
  accessUntil: string | null;
  signedAt: string;
  status: number;
};

export function projectVerifiedAppleSubscription(input: {
  transaction: VerifiedAppleTransaction;
  status: number;
  expectedAccountToken: string;
  environment: "Production" | "Sandbox";
  now: number;
  renewal?: { gracePeriodExpiresDate?: number; signedDate?: number };
}): AppleSubscriptionSnapshot {
  const t = input.transaction;
  if (
    t.bundleId !== "com.altitutor.ucat" ||
    t.environment !== input.environment ||
    t.type !== "Auto-Renewable Subscription" ||
    !t.productId ||
    !Object.hasOwn(APPLE_UNLIMITED_PRODUCTS, t.productId) ||
    !t.appAccountToken ||
    t.appAccountToken.toLowerCase() !==
      input.expectedAccountToken.toLowerCase() ||
    !t.originalTransactionId ||
    !/^\d+$/.test(t.originalTransactionId) ||
    !t.transactionId ||
    !/^\d+$/.test(t.transactionId) ||
    !Number.isSafeInteger(t.signedDate) ||
    !Number.isSafeInteger(t.expiresDate) ||
    ![1, 2, 3, 4, 5].includes(input.status)
  ) {
    throw new Error(
      "Apple subscription does not match this account or product",
    );
  }
  const expires = t.expiresDate!;
  const until =
    input.status === 4 ? input.renewal?.gracePeriodExpiresDate : expires;
  const grantsAccess =
    t.revocationDate === undefined &&
    (input.status === 1 || input.status === 4) &&
    Number.isSafeInteger(until) &&
    until! > input.now;
  return {
    originalTransactionId: t.originalTransactionId,
    transactionId: t.transactionId,
    productId: t.productId,
    accountToken: t.appAccountToken.toLowerCase(),
    environment: input.environment,
    accessUntil: grantsAccess ? new Date(until!).toISOString() : null,
    signedAt: new Date(
      Math.max(t.signedDate!, input.renewal?.signedDate ?? 0),
    ).toISOString(),
    status: input.status,
  };
}
