import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";

function isQuotaExceededPayload(value: unknown): value is QuotaExceededPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.code === "QUOTA_EXCEEDED" &&
    typeof record.area === "string" &&
    typeof record.used === "number" &&
    typeof record.limit === "number" &&
    typeof record.period === "string"
  );
}

/** Parses a failed fetch response for quota-exceeded payloads. */
export async function parseQuotaExceededResponse(
  response: Response,
): Promise<QuotaExceededPayload | null> {
  if (response.status !== 403) return null;
  try {
    const body: unknown = await response.json();
    return isQuotaExceededPayload(body) ? body : null;
  } catch {
    return null;
  }
}

export class QuotaExceededError extends Error {
  readonly payload: QuotaExceededPayload;

  constructor(payload: QuotaExceededPayload) {
    super("Quota exceeded");
    this.name = "QuotaExceededError";
    this.payload = payload;
  }
}

/** Throws QuotaExceededError when the response is a quota 403. */
export async function assertOkOrQuotaExceeded(response: Response): Promise<void> {
  if (response.ok) return;
  const payload = await parseQuotaExceededResponse(response);
  if (payload) throw new QuotaExceededError(payload);
}
