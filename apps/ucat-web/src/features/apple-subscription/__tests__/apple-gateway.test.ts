/** @jest-environment node */
import { createAppleVerifier } from "../apple-gateway";

test("forged client transaction and notification data cannot pass Apple signature verification", async () => {
  await expect(
    createAppleVerifier("Production").verifyAndDecodeTransaction(
      "e30.e30.invalid",
    ),
  ).rejects.toThrow();
  await expect(
    createAppleVerifier("Production").verifyAndDecodeNotification(
      "e30.e30.invalid",
    ),
  ).rejects.toThrow();
});

import { readAppleSubscription } from "../apple-gateway";

const now = Date.parse("2026-11-28T00:00:00Z");
const accountToken = "a983d340-47f2-4507-a2ee-f180b983fc20";
const transaction = {
  originalTransactionId: "531001",
  transactionId: "531002",
  productId: "com.altitutor.ucat.unlimited.monthly",
  appAccountToken: accountToken,
  bundleId: "com.altitutor.ucat",
  environment: "Production",
  expiresDate: now + 86400000,
  signedDate: now - 1000,
  type: "Auto-Renewable Subscription",
};

test("purchase verification uses current Apple status rather than replaying an old active transaction", async () => {
  const client = {
    getTransactionInfo: async () => ({ signedTransactionInfo: "old-signed" }),
    getAllSubscriptionStatuses: async () => ({
      data: [
        {
          lastTransactions: [
            {
              originalTransactionId: "531001",
              status: 5,
              signedTransactionInfo: "current-signed",
              signedRenewalInfo: "renewal-signed",
            },
          ],
        },
      ],
    }),
  };
  const verifier = {
    verifyAndDecodeTransaction: async () => transaction,
    verifyAndDecodeRenewalInfo: async () => ({
      originalTransactionId: "531001",
      signedDate: now,
    }),
  };
  const result = await readAppleSubscription({
    transactionId: "531002",
    expectedAccountToken: accountToken,
    environment: "Production",
    client,
    verifier,
    now,
  });
  expect(result.accessUntil).toBeNull();
});
