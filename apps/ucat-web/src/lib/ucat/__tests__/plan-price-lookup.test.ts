import type Stripe from "stripe";
import {
  stripePriceMatchesUcatPlan,
  type UcatPlanPriceRow,
} from "@/lib/ucat/plan-price-lookup";

const weeklyPlan: UcatPlanPriceRow = {
  plan_tier: "unlimited",
  billing_interval: "week",
  base_price_cents: 1500,
  stripe_price_id: "price_weekly",
  checkout_enabled: true,
};

function planWithPriceId(stripePriceId: string): UcatPlanPriceRow {
  return { ...weeklyPlan, stripe_price_id: stripePriceId };
}

function stripeWithPrice(price: Partial<Stripe.Price>): Stripe {
  return {
    prices: {
      retrieve: jest.fn().mockResolvedValue({
        active: true,
        currency: "aud",
        unit_amount: 1500,
        recurring: { interval: "week", interval_count: 1 },
        ...price,
      }),
    },
  } as unknown as Stripe;
}

describe("stripePriceMatchesUcatPlan", () => {
  it("accepts the configured amount and interval", async () => {
    await expect(
      stripePriceMatchesUcatPlan(stripeWithPrice({}), weeklyPlan),
    ).resolves.toBe(true);
  });

  it("rejects a stale Stripe amount", async () => {
    await expect(
      stripePriceMatchesUcatPlan(
        stripeWithPrice({ unit_amount: 2800 }),
        planWithPriceId("price_stale_amount"),
      ),
    ).resolves.toBe(false);
  });

  it("rejects a mismatched billing interval", async () => {
    await expect(
      stripePriceMatchesUcatPlan(
        stripeWithPrice({
          recurring: {
            interval: "month",
            interval_count: 1,
          } as Stripe.Price.Recurring,
        }),
        planWithPriceId("price_wrong_interval"),
      ),
    ).resolves.toBe(false);
  });

  it("reuses a recent successful validation", async () => {
    const stripe = stripeWithPrice({});
    const plan = planWithPriceId("price_cached");

    await stripePriceMatchesUcatPlan(stripe, plan);
    await stripePriceMatchesUcatPlan(stripe, plan);

    expect(stripe.prices.retrieve).toHaveBeenCalledTimes(1);
  });
});
