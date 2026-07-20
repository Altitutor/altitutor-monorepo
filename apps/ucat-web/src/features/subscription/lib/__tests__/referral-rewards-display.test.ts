import { buildAvailableRewardDisplay } from "@/features/subscription/lib/referral-rewards-display";
import type { EarnedReferralGift } from "@/features/subscription/api/referral-gifts";

function gift(
  partial: Pick<EarnedReferralGift, "id" | "duration_interval">,
): EarnedReferralGift {
  return {
    ...partial,
    status: "available",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildAvailableRewardDisplay", () => {
  it("describes a redeemable free Unlimited week with a checkout CTA", () => {
    const display = buildAvailableRewardDisplay({
      earnedGifts: [gift({ id: "gift-1", duration_interval: "week" })],
      queuedFreeBills: 0,
      usedCount: 0,
      billingInterval: null,
      planLabel: "Unlimited",
    });

    expect(display.title).toBe("1 free week");
    expect(display.detail).toContain("UCAT Unlimited");
    expect(display.cta).toEqual({
      label: "Use free week",
      href: "/checkout?tier=unlimited&interval=week&context=referral_gift&gift=gift-1",
    });
  });

  it("aggregates matching earned gifts and notes extras", () => {
    const display = buildAvailableRewardDisplay({
      earnedGifts: [
        gift({ id: "gift-1", duration_interval: "week" }),
        gift({ id: "gift-2", duration_interval: "week" }),
        gift({ id: "gift-3", duration_interval: "month" }),
      ],
      queuedFreeBills: 0,
      usedCount: 1,
      billingInterval: null,
      planLabel: "Unlimited",
    });

    expect(display.title).toBe("2 free weeks");
    expect(display.extra).toBe("1 more reward waiting");
    expect(display.usedCount).toBe(1);
    expect(display.cta?.href).toContain("gift=gift-1");
  });

  it("describes queued free bills for paid weekly Unlimited", () => {
    const display = buildAvailableRewardDisplay({
      earnedGifts: [],
      queuedFreeBills: 1,
      usedCount: 2,
      billingInterval: "week",
      planLabel: "Unlimited",
    });

    expect(display.title).toBe("1 free week");
    expect(display.detail).toBe(
      "of your Unlimited plan · applies on your next bill",
    );
    expect(display.cta).toBeNull();
    expect(display.usedCount).toBe(2);
  });

  it("describes monthly Pro free-bill rewards", () => {
    const display = buildAvailableRewardDisplay({
      earnedGifts: [],
      queuedFreeBills: 2,
      usedCount: 0,
      billingInterval: "month",
      planLabel: "Pro",
    });

    expect(display.title).toBe("2 free months");
    expect(display.detail).toContain("your Pro plan");
  });

  it("uses month wording for annual billing credits", () => {
    const display = buildAvailableRewardDisplay({
      earnedGifts: [],
      queuedFreeBills: 1,
      usedCount: 0,
      billingInterval: "year",
      planLabel: "Unlimited",
    });

    expect(display.title).toBe("1 free month");
    expect(display.detail).toContain("credit on your Unlimited plan");
  });

  it("shows an empty state when nothing is available", () => {
    const display = buildAvailableRewardDisplay({
      earnedGifts: [],
      queuedFreeBills: 0,
      usedCount: 0,
      billingInterval: null,
      planLabel: "Unlimited",
    });

    expect(display.title).toBe("None ready");
    expect(display.cta).toBeNull();
  });
});
