import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInSeededStudent } from "./helpers/auth";

const aliceId = "10000000-0000-0000-0000-000000000001";

function localAdmin() {
  const url = process.env.UCAT_E2E_SUPABASE_URL;
  const key = process.env.UCAT_E2E_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("The local Supabase E2E environment is unavailable.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

test("signup recognizes an existing account and preserves return intent @critical @compat", async ({
  page,
}) => {
  await page.goto("/signup?redirect=%2Fsessions");
  await expect(
    page.getByRole("heading", { name: /Start with UCAT Free/u }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("alice.williams@student.test");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === "/login" &&
      url.searchParams.get("existing") === "1" &&
      url.searchParams.get("redirect") === "/sessions"
    );
  });
});

test("a free student can enter checkout with the selected plan contract", async ({
  page,
}) => {
  const admin = localAdmin();
  const { data: original, error: readError } = await admin
    .from("students")
    .select("ucat_online_tier_override")
    .eq("id", aliceId)
    .single();
  if (readError) throw readError;

  const { error: updateError } = await admin
    .from("students")
    .update({ ucat_online_tier_override: "force_free" })
    .eq("id", aliceId);
  if (updateError) throw updateError;

  try {
    await page.route("**/api/ucat/subscription-config", async (route) => {
      const upstream = await route.fetch();
      const config = (await upstream.json()) as Record<string, unknown> & {
        planPrices?: Array<Record<string, unknown>>;
      };
      await route.fulfill({
        response: upstream,
        json: {
          ...config,
          unlimitedProductConfigured: true,
          planPrices: (config.planPrices ?? []).map((price) => ({
            ...price,
            configured: true,
            checkoutEnabled: true,
          })),
        },
      });
    });
    await page.route("**/api/ucat/subscription/billing", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          subscription: null,
          subscriptions: [],
          invoices: [],
        }),
      }),
    );

    let checkoutRequest: Record<string, unknown> | null = null;
    await page.route("**/api/ucat/checkout", async (route) => {
      checkoutRequest = route.request().postDataJSON() as Record<
        string,
        unknown
      >;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          clientSecret: "e2e_client_secret",
          checkoutSessionId: "cs_e2e",
          referralGiftApplied: false,
          trialEligible: false,
          trialDays: 0,
        }),
      });
    });

    await signInSeededStudent(page, "/subscribe");
    const subscribe = page.getByRole("button", {
      name: /Subscribe|Start free trial/u,
    });
    await expect(subscribe).toBeEnabled();
    await subscribe.click();
    await expect(page).toHaveURL((url) => url.pathname === "/checkout");
    await expect(
      page.getByRole("heading", { name: "Pay securely" }),
    ).toBeVisible();
    await expect.poll(() => checkoutRequest).toMatchObject({
      tier: "unlimited",
      interval: "month",
      returnContext: "subscribe",
    });
  } finally {
    const { error: restoreError } = await admin
      .from("students")
      .update({
        ucat_online_tier_override: original.ucat_online_tier_override,
      })
      .eq("id", aliceId);
    if (restoreError) throw restoreError;
  }
});
