export type PlanPickerTier = "free" | "unlimited" | "pro";

export function onlineTierRank(tier: string | null | undefined): number {
  if (tier === "pro") return 2;
  if (tier === "unlimited" || tier === "unlimited_trial") return 1;
  return 0;
}

export function planPickerTierRank(tier: PlanPickerTier): number {
  if (tier === "pro") return 2;
  if (tier === "unlimited") return 1;
  return 0;
}

/** Tiers above the user's current plan for inline upsell cards. */
export function upgradePlanPickerTiers(
  onlineTier: string | null | undefined,
  subscriptionPlanTier?: string | null,
): PlanPickerTier[] {
  const rank = Math.max(
    onlineTierRank(onlineTier),
    subscriptionPlanTier === "pro"
      ? 2
      : subscriptionPlanTier === "unlimited"
        ? 1
        : 0,
  );
  if (rank >= 2) return [];
  if (rank === 1) return ["pro"];
  return ["unlimited", "pro"];
}

export function canDowngradeToTier(
  onlineTier: string | null | undefined,
  target: PlanPickerTier,
  subscriptionPlanTier?: string | null,
): boolean {
  const rank = Math.max(
    onlineTierRank(onlineTier),
    subscriptionPlanTier === "pro"
      ? 2
      : subscriptionPlanTier === "unlimited"
        ? 1
        : 0,
  );
  return rank > planPickerTierRank(target);
}
