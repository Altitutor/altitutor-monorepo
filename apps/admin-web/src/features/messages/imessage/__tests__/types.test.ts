import { getCommandStatusLabel } from '../types';

describe('getCommandStatusLabel', () => {
  it.each([
    ['queued', 'Queued'],
    ['claimed', 'Claimed'],
    ['succeeded', 'Succeeded'],
    ['failed', 'Failed'],
    ['ambiguous', 'Ambiguous'],
    ['cancelled', 'Cancelled'],
  ] as const)('formats %s', (status, expected) => {
    expect(getCommandStatusLabel(status)).toBe(expected);
  });
});
