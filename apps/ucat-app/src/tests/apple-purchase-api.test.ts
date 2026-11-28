import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient } from "../lib/api-client";
import { createAppleBillingApi } from "../features/apple-subscription/purchase-api";
import type { SupabaseClient } from "@supabase/supabase-js";

const auth = {
  getSession: async () => ({
    data: { session: { access_token: "local-test-token" } },
    error: null,
  }),
} as Pick<SupabaseClient["auth"], "getSession" | "getUser">;

test("Apple preparation reaches the server as an authenticated JSON object", async () => {
  const api = createAppleBillingApi(
    createApiClient(
      auth,
      (p) => `https://test.invalid${p}`,
      async (url, options) => {
        assert.equal(url, "https://test.invalid/api/ucat/apple/prepare");
        const body: unknown = JSON.parse(String(options?.body));
        if (typeof body !== "object" || body === null)
          return Response.json(
            { error: "Unknown subscription" },
            { status: 400 },
          );
        assert.deepEqual(body, {
          productId: "com.altitutor.ucat.unlimited.monthly",
        });
        assert.equal(
          new Headers(options?.headers).get("Authorization"),
          "Bearer local-test-token",
        );
        return Response.json({ accountToken: "bound-token" });
      },
    ),
  );
  assert.deepEqual(await api.prepare("com.altitutor.ucat.unlimited.monthly"), {
    accountToken: "bound-token",
  });
});

test("Apple restore verification reaches the server as a transaction object", async () => {
  const api = createAppleBillingApi(
    createApiClient(
      auth,
      (p) => `https://test.invalid${p}`,
      async (url, options) => {
        assert.equal(url, "https://test.invalid/api/ucat/apple");
        assert.deepEqual(JSON.parse(String(options?.body)), {
          transactionId: "531009",
          environment: "Sandbox",
        });
        return Response.json({ provider: "apple", canPurchase: false });
      },
    ),
  );
  assert.equal((await api.verify("531009", "Sandbox")).provider, "apple");
});
