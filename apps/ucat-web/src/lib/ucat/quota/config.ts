import type { UcatQuotaArea, UcatQuotaPeriod } from "@/features/ucat-access/types/quota";

export type UcatFreeQuotaConfig = {
  practice: { limit: number; period: UcatQuotaPeriod };
  sets: { limit: number; period: UcatQuotaPeriod };
  mocks: { limit: number; period: UcatQuotaPeriod };
  learn: { limit: number; period: UcatQuotaPeriod };
  skill_trainer: { limit: number; period: UcatQuotaPeriod };
};

type ConfigRow = {
  free_practice_limit: number;
  free_practice_period: string;
  free_sets_limit: number;
  free_sets_period: string;
  free_mocks_limit: number;
  free_mocks_period: string;
  free_learn_limit: number;
  free_learn_period: string;
  free_skill_trainer_limit: number;
  free_skill_trainer_period: string;
};

export const DEFAULT_FREE_QUOTA_CONFIG: UcatFreeQuotaConfig = {
  practice: { limit: 20, period: "day" },
  sets: { limit: 2, period: "week" },
  mocks: { limit: 1, period: "month" },
  learn: { limit: 3, period: "week" },
  skill_trainer: { limit: 5, period: "week" },
};

function parsePeriod(value: string): UcatQuotaPeriod {
  if (value === "day" || value === "week" || value === "month") return value;
  return "day";
}

export function mapQuotaConfigRow(row: ConfigRow | null): UcatFreeQuotaConfig {
  if (!row) return DEFAULT_FREE_QUOTA_CONFIG;
  return {
    practice: {
      limit: row.free_practice_limit ?? DEFAULT_FREE_QUOTA_CONFIG.practice.limit,
      period: parsePeriod(row.free_practice_period),
    },
    sets: {
      limit: row.free_sets_limit ?? DEFAULT_FREE_QUOTA_CONFIG.sets.limit,
      period: parsePeriod(row.free_sets_period),
    },
    mocks: {
      limit: row.free_mocks_limit ?? DEFAULT_FREE_QUOTA_CONFIG.mocks.limit,
      period: parsePeriod(row.free_mocks_period),
    },
    learn: {
      limit: row.free_learn_limit ?? DEFAULT_FREE_QUOTA_CONFIG.learn.limit,
      period: parsePeriod(row.free_learn_period),
    },
    skill_trainer: {
      limit: row.free_skill_trainer_limit ?? DEFAULT_FREE_QUOTA_CONFIG.skill_trainer.limit,
      period: parsePeriod(row.free_skill_trainer_period),
    },
  };
}

export function getAreaConfig(
  config: UcatFreeQuotaConfig,
  area: UcatQuotaArea,
): { limit: number; period: UcatQuotaPeriod } {
  return config[area];
}
