export const UCAT_ONLINE_TIER_LABELS: Record<string, string> = {
  free: "UCAT Free",
  unlimited_trial: "UCAT Unlimited (trial)",
  unlimited: "UCAT Unlimited",
  pro: "UCAT Pro",
  pro_trial: "UCAT Pro (trial)",
};

export const UCAT_CURRENT_PLAN_BENEFITS: Record<string, string[]> = {
  free: [
    "Limited daily access across practice, sets, mocks, learn, and skill trainer",
    "Upgrade anytime for unlimited access and practice-day discounts",
  ],
  unlimited_trial: [
    "Unlimited access to all online UCAT areas during your trial",
    "Earn practice-day billing discounts before your first charge",
    "Human-support entitlements begin when you convert to paid UCAT Pro",
  ],
  unlimited: [
    "Unlimited access to all online UCAT areas",
    "Practice-day discounts when you hit your daily question target",
    "Full practice library, mocks, skill trainer, and progress analytics",
  ],
  pro: [
    "Everything in UCAT Unlimited",
    "1 online training workshop per month",
    "On-demand help from tutors",
    "1-1 performance review each month",
  ],
  pro_trial: [
    "Unlimited online access during your trial",
    "Earn practice-day billing discounts before your first charge",
    "Pro tutor benefits (workshops, on-demand help, monthly review) start when your trial converts to paid",
  ],
};

/** Accent plan tier chip (dashboard quota / discount cards). */
export const UCAT_PLAN_TIER_BADGE_CLASS =
  "shrink-0 border-0 bg-accent text-[10px] font-semibold text-primary-foreground";
