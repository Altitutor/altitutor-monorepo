import { projectVerifiedAppleSubscription } from "../verified-subscription";

const now = Date.parse("2026-11-28T00:00:00Z");
const token = "a983d340-47f2-4507-a2ee-f180b983fc20";
const transaction = {
  originalTransactionId: "1000001",
  transactionId: "1000002",
  productId: "com.altitutor.ucat.unlimited.monthly",
  appAccountToken: token,
  bundleId: "com.altitutor.ucat",
  environment: "Production",
  expiresDate: now + 86400000,
  signedDate: now - 1000,
  type: "Auto-Renewable Subscription",
};

test("a verified active Apple subscription grants Unlimited to its bound account until expiry", () => {
  expect(
    projectVerifiedAppleSubscription({
      transaction,
      status: 1,
      expectedAccountToken: token,
      environment: "Production",
      now,
    }),
  ).toEqual({
    originalTransactionId: "1000001",
    transactionId: "1000002",
    productId: "com.altitutor.ucat.unlimited.monthly",
    accountToken: token,
    environment: "Production",
    accessUntil: new Date(now + 86400000).toISOString(),
    signedAt: new Date(now - 1000).toISOString(),
    status: 1,
  });
});

test("a verified revocation removes access even when the revoked timestamp is zero", () => {
  const result = projectVerifiedAppleSubscription({
    transaction: { ...transaction, revocationDate: 0 },
    status: 1,
    expectedAccountToken: token,
    environment: "Production",
    now,
  });
  expect(result.accessUntil).toBeNull();
});

test.each([
  { appAccountToken: "33bd3075-c5b6-4f6c-a32a-5897666a543e" },
  { environment: "Sandbox" },
  { bundleId: "com.other.app" },
  { productId: "unrelated.product" },
])(
  "verified purchase with mismatched identity cannot grant access: %o",
  (change) => {
    expect(() =>
      projectVerifiedAppleSubscription({
        transaction: { ...transaction, ...change },
        status: 1,
        expectedAccountToken: token,
        environment: "Production",
        now,
      }),
    ).toThrow(/does not match/);
  },
);

test.each([2, 3, 5])(
  "Apple status %s cannot grant access even with a future transaction expiry",
  (status) => {
    expect(
      projectVerifiedAppleSubscription({
        transaction,
        status,
        expectedAccountToken: token,
        environment: "Production",
        now,
      }).accessUntil,
    ).toBeNull();
  },
);

test("expiry is checked without waiting for a server notification", () => {
  expect(
    projectVerifiedAppleSubscription({
      transaction: { ...transaction, expiresDate: now },
      status: 1,
      expectedAccountToken: token,
      environment: "Production",
      now,
    }).accessUntil,
  ).toBeNull();
});

test("grace access uses the verified renewal deadline rather than the expired paid period", () => {
  expect(
    projectVerifiedAppleSubscription({
      transaction: { ...transaction, expiresDate: now - 1000 },
      renewal: { gracePeriodExpiresDate: now + 3600000, signedDate: now },
      status: 4,
      expectedAccountToken: token,
      environment: "Production",
      now,
    }).accessUntil,
  ).toBe("2026-11-28T01:00:00.000Z");
});
