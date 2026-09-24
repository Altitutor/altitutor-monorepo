export interface SessionBillingAdjustmentPassResult {
  claimed: number;
  succeeded: number;
  failed: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeTargetedAdjustmentIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) return null;

  const ids = [...new Set(value as string[])];
  if (ids.length === 0 || ids.length > 100 || ids.some((id) => !UUID_PATTERN.test(id))) {
    return null;
  }

  return ids;
}

export async function processTargetedSessionBilling(
  adjustmentIds: string[],
  processPass: () => Promise<SessionBillingAdjustmentPassResult>,
): Promise<SessionBillingAdjustmentPassResult> {
  const total = { claimed: 0, succeeded: 0, failed: 0 };

  for (let pass = 0; pass <= adjustmentIds.length; pass += 1) {
    const result = await processPass();
    total.claimed += result.claimed;
    total.succeeded += result.succeeded;
    total.failed += result.failed;

    if (result.claimed === 0) break;
  }

  return total;
}
