import { resolveExistingSubscriberDestination } from "../resolve-checkout-entry";

describe("resolveExistingSubscriberDestination", () => {
  it("routes an Unlimited subscriber selecting Pro to the upgrade flow", () => {
    expect(
      resolveExistingSubscriberDestination(
        [{ status: "active", plan_tier: "unlimited" }],
        "pro",
      ),
    ).toBe("/subscribe");
  });

  it("routes an existing subscriber selecting their current plan to management", () => {
    expect(
      resolveExistingSubscriberDestination(
        [{ status: "trialing", plan_tier: "unlimited" }],
        "unlimited",
      ),
    ).toBe("/settings/plan/subscription");
  });

  it("routes a Pro subscriber away from a second checkout", () => {
    expect(
      resolveExistingSubscriberDestination(
        [{ status: "past_due", plan_tier: "pro" }],
        "unlimited",
      ),
    ).toBe("/settings/plan/subscription");
  });

  it("allows checkout when there is no manageable subscription", () => {
    expect(
      resolveExistingSubscriberDestination(
        [{ status: "canceled", plan_tier: "unlimited" }],
        "unlimited",
      ),
    ).toBeNull();
  });
});
