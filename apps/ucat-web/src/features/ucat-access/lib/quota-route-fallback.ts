import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";

const QUOTA_AREA_FALLBACKS: Record<
  UcatQuotaArea,
  { href: string; label: string }
> = {
  learn: { href: "/learn", label: "Back to learning modules" },
  practice: { href: "/practice", label: "Back to practice" },
  sets: { href: "/sets", label: "Back to sets" },
  mocks: { href: "/mocks", label: "Back to mocks" },
  skill_trainer: {
    href: "/skill-trainer",
    label: "Back to skill trainer",
  },
};

export function quotaRouteFallback(area: UcatQuotaArea) {
  return QUOTA_AREA_FALLBACKS[area];
}
