/**
 * Tests for quick filter placeholder resolution
 */

import { resolveQuickFilterPlaceholders } from '../quick-filters';

describe('resolveQuickFilterPlaceholders', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15')); // Monday
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves $ME$ with currentUserId', () => {
    const config = { user_id: ['$ME$'] };
    expect(resolveQuickFilterPlaceholders(config, 'user-123')).toEqual({
      user_id: ['user-123'],
    });
  });

  it('keeps $ME$ when currentUserId is undefined', () => {
    const config = { user_id: ['$ME$'] };
    expect(resolveQuickFilterPlaceholders(config)).toEqual({ user_id: ['$ME$'] });
  });

  it('resolves $TODAY$ to YYYY-MM-DD', () => {
    const config = { from: ['$TODAY$'] };
    expect(resolveQuickFilterPlaceholders(config)).toEqual({ from: ['2024-01-15'] });
  });

  it('resolves $TOMORROW$ and $YESTERDAY$', () => {
    expect(resolveQuickFilterPlaceholders({ d: ['$TOMORROW$'] })).toEqual({
      d: ['2024-01-16'],
    });
    expect(resolveQuickFilterPlaceholders({ d: ['$YESTERDAY$'] })).toEqual({
      d: ['2024-01-14'],
    });
  });

  it('resolves $THIS_WEEK$ based on from/to key', () => {
    const config = { from: ['$THIS_WEEK$'], to: ['$THIS_WEEK$'] };
    const result = resolveQuickFilterPlaceholders(config);
    expect(result.from?.[0]).toBe('2024-01-15'); // Monday
    expect(result.to?.[0]).toBe('2024-01-21'); // Sunday
  });

  it('passes through non-placeholder strings', () => {
    const config = { status: ['ACTIVE', 'INACTIVE'] };
    expect(resolveQuickFilterPlaceholders(config)).toEqual(config);
  });
});
