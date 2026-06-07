import type { UcatQuotaUsageResponse } from "@/features/ucat-access/types/quota";

export async function fetchQuotaUsage(): Promise<UcatQuotaUsageResponse> {
  const res = await fetch("/api/ucat/quota-usage", {
    method: "GET",
    credentials: "same-origin",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to load quota usage");
  }

  return res.json() as Promise<UcatQuotaUsageResponse>;
}
