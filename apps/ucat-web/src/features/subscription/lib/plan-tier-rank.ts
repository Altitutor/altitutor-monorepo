export type PlanPickerTier = "free" | "unlimited";

export function onlineTierRank(tier: string | null | undefined): number {
  if (tier === "unlimited" || tier === "unlimited_trial") return 1;
  return 0;
}

export function planPickerTierRank(tier: PlanPickerTier): number {
  if (tier === "unlimited") return 1;
  return 0;
}

export function canDowngradeToTier(
  onlineTier: string | null | undefined,
  target: PlanPickerTier,
  subscriptionPlanTier?: string | null,
): boolean {
  const rank = Math.max(
    onlineTierRank(onlineTier),
    subscriptionPlanTier === "unlimited" ? 1 : 0,
  );
  return rank > planPickerTierRank(target);
}
