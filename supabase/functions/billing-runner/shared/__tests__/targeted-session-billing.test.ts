import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import {
  normalizeTargetedAdjustmentIds,
  processTargetedSessionBilling,
} from '../targeted-session-billing.ts';

describe('targeted session billing requests', () => {
  it('deduplicates and validates a bounded list of adjustment IDs', () => {
    expect(normalizeTargetedAdjustmentIds([
      'f5000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000002',
    ])).toEqual([
      'f5000000-0000-4000-8000-000000000001',
      'f5000000-0000-4000-8000-000000000002',
    ]);
    expect(normalizeTargetedAdjustmentIds(['not-a-uuid'])).toBeNull();
    expect(normalizeTargetedAdjustmentIds([])).toBeNull();
  });

  it('makes bounded passes so a successful credit can unlock its due replacement', async () => {
    const passResults = [
      { claimed: 1, succeeded: 1, failed: 0 },
      { claimed: 1, succeeded: 1, failed: 0 },
      { claimed: 0, succeeded: 0, failed: 0 },
    ];
    let calls = 0;

    const result = await processTargetedSessionBilling(
      ['f5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000002'],
      () => Promise.resolve(passResults[calls++]!),
    );

    expect(result).toEqual({ claimed: 2, succeeded: 2, failed: 0 });
    expect(calls).toBe(3);
  });
});
