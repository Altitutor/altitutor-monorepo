import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInSeededStudent } from "./helpers/auth";

const studentId = "10000000-0000-0000-0000-000000000001";

test("a founder pass grants expiring Unlimited without payment checkout @critical", async ({
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
  const { data: original, error: readError } = await admin
    .from("students")
    .select("ucat_online_tier_override, ucat_unlimited_trial_consumed_at")
    .eq("id", studentId)
    .single();
  if (readError) throw readError;
  const { data: existingSubscriptions } = await admin
    .from("student_subscriptions")
    .select("id")
    .eq("student_id", studentId);
  const code = `F-E2E-${Date.now()}`;
  const { data: offer, error: offerError } = await admin
    .from("ucat_founder_offers")
    .insert({
      code,
      name: "Personal founder invitation",
      campaign: "local-browser-test",
      kind: "access_pass",
      duration_unit: "week",
      duration_count: 2,
      max_redemptions: 1,
    })
    .select("id")
    .single();
  if (offerError) throw offerError;
  let checkoutRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/ucat/checkout")
      checkoutRequests++;
  });
  try {
    const { error } = await admin
      .from("students")
      .update({
        ucat_online_tier_override: "default",
        ucat_unlimited_trial_consumed_at: null,
      })
      .eq("id", studentId);
    if (error) throw error;
    await signInSeededStudent(page, `/invite/${code}`);
    await expect(
      page.getByText("2 free weeks of UCAT Unlimited"),
    ).toBeVisible();
    await expect(page.getByText(/No card required/)).toBeVisible();
    await page
      .getByRole("button", { name: "Start free access", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /You will not be charged automatically/ }),
    ).toBeVisible();
    expect(checkoutRequests).toBe(0);
    const { data: claim } = await admin
      .from("ucat_founder_redemptions")
      .select("*")
      .eq("offer_id", offer.id)
      .single();
    expect(claim?.status).toBe("redeemed");
    expect(claim?.stripe_subscription_id).toBeNull();
    const { data: subscriptions } = await admin
      .from("student_subscriptions")
      .select("id")
      .eq("student_id", studentId);
    expect(subscriptions).toEqual(existingSubscriptions);
    const { data: tier } = await admin.rpc("get_student_ucat_online_tier", {
      p_student_id: studentId,
    });
    expect(tier).toBe("unlimited");
    await page.reload();
    await expect(
      page.getByRole("alert").filter({ hasText: "claimed" }),
    ).toBeVisible();
    const { count } = await admin
      .from("ucat_founder_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offer.id);
    expect(count).toBe(1);
  } finally {
    await admin
      .from("ucat_founder_redemptions")
      .delete()
      .eq("offer_id", offer.id);
    await admin.from("ucat_founder_offers").delete().eq("id", offer.id);
    await admin.from("students").update(original).eq("id", studentId);
  }
});
