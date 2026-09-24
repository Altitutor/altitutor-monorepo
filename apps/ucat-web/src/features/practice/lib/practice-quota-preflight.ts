import type {
  UcatQuotaPeriod,
  UcatQuotaUsageResponse,
} from "@/features/ucat-access/types/quota";
import type { PracticeSessionStartInput } from "@/features/practice/api/create-practice-session";

export type PracticeQuotaPreflightResult =
  | { status: "ok" }
  | {
      status: "atLimit";
      used: number;
      limit: number;
      period: UcatQuotaPeriod;
    }
  | {
      status: "reduce";
      remainingCount: number;
      requestedCount: number;
      payload: PracticeSessionStartInput["payload"];
    };

export function evaluatePracticeQuotaPreflight(
  quota: UcatQuotaUsageResponse | undefined,
  input: PracticeSessionStartInput,
): PracticeQuotaPreflightResult {
  const practiceQuota = quota?.areas.find((area) => area.area === "practice");
  const enforceFreeQuota =
    quota?.onlineTier === "free" && !quota.isQuotaExempt && practiceQuota;

  if (!enforceFreeQuota || !practiceQuota) {
    return { status: "ok" };
  }

  const remainingCount = Math.max(0, practiceQuota.limit - practiceQuota.used);
  if (practiceQuota.limit === 0 || remainingCount === 0) {
    return {
      status: "atLimit",
      used: practiceQuota.used,
      limit: practiceQuota.limit,
      period: practiceQuota.period,
    };
  }

  if (
    !input.payload.unlimited &&
    input.payload.questionCount > remainingCount
  ) {
    return {
      status: "reduce",
      remainingCount,
      requestedCount: input.payload.questionCount,
      payload: { ...input.payload, questionCount: remainingCount },
    };
  }

  return { status: "ok" };
}
