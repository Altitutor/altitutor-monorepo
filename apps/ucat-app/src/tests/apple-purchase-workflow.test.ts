import assert from "node:assert/strict";
import { test } from "node:test";
import { settleApplePurchase } from "../features/apple-subscription/purchase-workflow";

test("an unverifiable Apple purchase stays unfinished so restore can retry safely", async () => {
  let finished = false;
  await assert.rejects(
    settleApplePurchase({
      purchase: {
        id: "531002",
        productId: "com.altitutor.ucat.unlimited.monthly",
        purchaseState: "purchased",
        storeId: "apple",
        environmentIOS: "Production",
      },
      userId: "owner",
      currentUserId: () => "owner",
      verify: async () => {
        throw new Error("Verification unavailable");
      },
      finish: async () => {
        finished = true;
      },
    }),
    /Verification unavailable/,
  );
  assert.equal(finished, false);
});

test("verified Apple purchase finishes only after verification and returns shared access", async () => {
  const calls: string[] = [];
  const result = await settleApplePurchase({
    purchase: {
      id: "531003",
      productId: "com.altitutor.ucat.unlimited.weekly",
      purchaseState: "purchased",
      storeId: "apple",
      environmentIOS: "Sandbox",
    },
    userId: "owner",
    currentUserId: () => "owner",
    verify: async (id, environment) => {
      assert.equal(id, "531003");
      assert.equal(environment, "Sandbox");
      calls.push("verified");
      return "unlimited";
    },
    finish: async () => {
      calls.push("finished");
    },
  });
  assert.equal(result, "unlimited");
  assert.deepEqual(calls, ["verified", "finished"]);
});

test("changing Altitutor accounts during verification leaves the purchase unfinished", async () => {
  let current = "owner";
  let finished = false;
  await assert.rejects(
    settleApplePurchase({
      purchase: {
        id: "531004",
        productId: "com.altitutor.ucat.unlimited.monthly",
        purchaseState: "purchased",
        storeId: "apple",
        environmentIOS: "Production",
      },
      userId: "owner",
      currentUserId: () => current,
      verify: async () => {
        current = "other";
        return "unlimited";
      },
      finish: async () => {
        finished = true;
      },
    }),
    /account changed/,
  );
  assert.equal(finished, false);
});

test("a pending Apple approval cannot be verified or finished as a completed purchase", async () => {
  let verified = false;
  let finished = false;
  await assert.rejects(
    settleApplePurchase({
      purchase: {
        id: "531005",
        productId: "com.altitutor.ucat.unlimited.monthly",
        purchaseState: "pending",
        storeId: "apple",
        environmentIOS: "Production",
      },
      userId: "owner",
      currentUserId: () => "owner",
      verify: async () => {
        verified = true;
      },
      finish: async () => {
        finished = true;
      },
    }),
    /not ready/,
  );
  assert.equal(verified, false);
  assert.equal(finished, false);
});

test("switching accounts during preparation prevents the Apple payment sheet from launching", async () => {
  const { launchBoundApplePurchase } = await import(
    "../features/apple-subscription/purchase-workflow"
  );
  let current = "owner";
  let launched = false;
  await assert.rejects(
    launchBoundApplePurchase({
      userId: "owner",
      currentUserId: () => current,
      prepare: async () => {
        current = "other";
        return { accountToken: "old-owner-token" };
      },
      request: async () => {
        launched = true;
      },
    }),
    /account changed/,
  );
  assert.equal(launched, false);
});
