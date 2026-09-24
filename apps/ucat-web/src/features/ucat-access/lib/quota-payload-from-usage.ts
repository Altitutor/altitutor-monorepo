import type {
  QuotaExceededPayload,
  UcatQuotaAreaUsage,
} from "@/features/ucat-access/types/quota";

export function quotaPayloadFromUsage(
  usage: UcatQuotaAreaUsage,
): QuotaExceededPayload {
  return {
    code: "QUOTA_EXCEEDED",
    area: usage.area,
    used: usage.used,
    limit: usage.limit,
    period: usage.period,
  };
}
