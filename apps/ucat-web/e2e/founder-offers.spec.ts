import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInSeededStudent } from "./helpers/auth";

const studentId = "10000000-0000-0000-0000-000000000001";

async function prepareCheckout(page: Page) {
  const response = await page.request.get("/api/ucat/subscription-config");
  const config = await response.json();
  await page.route("**/api/ucat/subscription-config", (route) =>
    route.fulfill({
      json: {
        ...config,
        unlimitedProductConfigured: true,
        planPrices: config.planPrices.map((price: Record<string, unknown>) => ({
          ...price,
          configured: true,
          checkoutEnabled: true,
        })),
      },
    }),
  );
  await page.route("**/api/ucat/subscription/billing", (route) =>
    route.fulfill({
      json: { subscriptions: [], subscription: null, invoices: [] },
    }),
  );
  await page.route("**/api/ucat/checkout", (route) => {
    const selection = route.request().postDataJSON() as {
      founderCode?: string;
    };
    return route.fulfill({
      json: {
        clientSecret: "cs_test_e2e_secret_demo",
        checkoutSessionId: "cs_e2e",
        referralGiftApplied: false,
        founderPercentOff: null,
        trialEligible: false,
        trialDays: 0,
        offerTrialDays: selection.founderCode ? 14 : 0,
      },
    });
  });
}

test("checkout applies a free-time code with Check code and updates due today @critical", async ({
  page,
}) => {
  await prepareCheckout(page);
  await page.route("**/api/ucat/invitations?code=*", (route) =>
    route.fulfill({
      json: {
        code: "WELCOME",
        kind: "access_pass",
        name: "Founder gift",
        description: "2 free weeks",
        terms: "Card required. Renews automatically.",
      },
    }),
  );
  await page.route("**/api/ucat/invitations", (route) =>
    route.fulfill({ json: { cancelled: true } }),
  );
  await signInSeededStudent(page);
  await page.goto("/checkout?tier=unlimited&interval=month&context=subscribe");
  await page
    .getByRole("button", { name: "Have an invitation or referral code?" })
    .click();
  await page
    .getByRole("textbox", { name: "Invitation or referral code" })
    .fill("WELCOME");
  await page.getByRole("button", { name: "Check code", exact: true }).click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("offer") === "WELCOME",
  );
  await expect(
    page.getByText("14 free days applied", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Due today", { exact: true }).locator(".."),
  ).toContainText("$0");
  await expect(
    page.getByText("Due today", { exact: true }).locator("..").locator("s"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start free access", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/No card required/)).toHaveCount(0);
  await expect(page.getByText("First bill", { exact: true })).toBeVisible();
});

for (const acceptGift of [false, true]) {
  test(`onboarding and sampler precede ${acceptGift ? "accepting" : "declining"} a founder gift`, async ({
    page,
  }) => {
    const url = process.env.UCAT_E2E_SUPABASE_URL;
    const key = process.env.UCAT_E2E_SERVICE_ROLE_KEY;
    if (
      !url ||
      !key ||
      !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
    )
      throw new Error("This test requires local Supabase.");
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: original, error } = await admin
      .from("students")
      .select(
        "ucat_signup_step, ucat_signup_completed_at, ucat_onboarding_completed_at, ucat_online_tier_override, ucat_unlimited_trial_consumed_at",
      )
      .eq("id", studentId)
      .single();
    if (error) throw error;
    const { data: attribution } = await admin
      .from("student_product_acquisition_attributions")
      .select("*")
      .eq("student_id", studentId)
      .eq("product", "UCAT_WEB")
      .maybeSingle();
    const code = `F-SAMPLER-${Date.now()}`;
    const { data: offer, error: offerError } = await admin
      .from("ucat_founder_offers")
      .insert({
        code,
        name: "Founder welcome gift",
        campaign: "local-browser-test",
        kind: "access_pass",
        duration_unit: "week",
        duration_count: 2,
      })
      .select("id")
      .single();
    if (offerError) throw offerError;
    try {
      await prepareCheckout(page);
      await signInSeededStudent(page);
      const { error: resetError } = await admin
        .from("students")
        .update({
          ucat_online_tier_override: "default",
          ucat_unlimited_trial_consumed_at: null,
          ucat_signup_step: 3,
          ucat_signup_completed_at: null,
          ucat_onboarding_completed_at: null,
        })
        .eq("id", studentId);
      if (resetError) throw resetError;
      await page.goto(`/signup?offer=${code}`);
      await page.getByText("Reddit", { exact: true }).click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page
        .getByRole("button", { name: /I’m already practicing/ })
        .click();
      await page
        .getByRole("button", { name: "Start sample questions" })
        .click();
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === "/signup/complete/sampler" &&
          url.searchParams.get("redirect") === `/subscribe?offer=${code}`,
      );
      await page.getByRole("button", { name: "Start 2 VR questions" }).click();
      await page.getByRole("button", { name: "Skip sample questions" }).click();
      await expect(
        page.getByRole("heading", { name: "Your gift is ready" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Accept gift and choose a plan",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: acceptGift
            ? "Accept gift and choose a plan"
            : "Continue with Free",
          exact: true,
        })
        .click();
      if (acceptGift) {
        await page
          .getByRole("button", { name: /Subscribe|Start free trial/u })
          .click();
        await expect(page).toHaveURL(
          (url) =>
            url.pathname === "/checkout" &&
            url.searchParams.get("offer") === code,
        );
        await expect(
          page.getByText("14 free days applied", { exact: true }),
        ).toBeVisible();
      } else {
        await expect(page).toHaveURL((url) => url.pathname === "/dashboard", {
          timeout: 20000,
        });
      }
      const { count } = await admin
        .from("ucat_founder_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("offer_id", offer.id);
      expect(count).toBe(0); // Entering checkout alone never redeems a gift.
    } finally {
      await admin
        .from("ucat_founder_redemptions")
        .delete()
        .eq("offer_id", offer.id);
      await admin.from("ucat_founder_offers").delete().eq("id", offer.id);
      await admin.from("students").update(original).eq("id", studentId);
      if (attribution)
        await admin
          .from("student_product_acquisition_attributions")
          .upsert(attribution);
      else
        await admin
          .from("student_product_acquisition_attributions")
          .delete()
          .eq("student_id", studentId)
          .eq("product", "UCAT_WEB");
    }
  });
}
