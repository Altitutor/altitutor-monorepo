/**
 * Tests for session format utilities
 */

import {
  formatSessionDate,
  formatSessionTimeRangeForDisplay,
  hasSessionStarted,
  type SessionTimeInput,
} from '../session-format';

describe('formatSessionDate', () => {
  it('formats a Date object as "DayName DD/MM/YYYY"', () => {
    expect(formatSessionDate(new Date('2024-01-15'))).toBe('Monday 15/01/2024');
  });

  it('formats an ISO string', () => {
    expect(formatSessionDate('2024-10-24T10:00:00Z')).toBe('Thursday 24/10/2024');
  });

  it('returns empty string for invalid date', () => {
    expect(formatSessionDate(new Date('invalid'))).toBe('');
    expect(formatSessionDate('not-a-date')).toBe('');
  });
});

describe('formatSessionTimeRangeForDisplay', () => {
  const formatTime = (t: string) => t;

  it('uses start_at and end_at when present', () => {
    const session: SessionTimeInput = {
      start_at: '2024-01-15T14:00:00',
      end_at: '2024-01-15T16:00:00',
    };
    expect(formatSessionTimeRangeForDisplay(session, formatTime)).toBe('14:00 - 16:00');
  });

  it('uses start_time and end_time when present', () => {
    const session: SessionTimeInput = {
      start_time: '14:00',
      end_time: '16:00',
    };
    expect(formatSessionTimeRangeForDisplay(session, formatTime)).toBe('14:00 - 16:00');
  });

  it('uses class.start_time and class.end_time when present', () => {
    const session: SessionTimeInput = {
      class: { start_time: '09:00', end_time: '11:00' },
    };
    expect(formatSessionTimeRangeForDisplay(session, formatTime)).toBe('09:00 - 11:00');
  });

  it('returns em dash when no time data', () => {
    expect(formatSessionTimeRangeForDisplay({}, formatTime)).toBe('—');
  });
});

describe('hasSessionStarted', () => {
  const now = new Date('2026-05-28T04:00:00.000Z');

  it('returns true when start_at is in the past', () => {
    expect(hasSessionStarted('2026-05-28T03:00:00.000Z', now)).toBe(true);
  });

  it('returns true when start_at equals now', () => {
    expect(hasSessionStarted('2026-05-28T04:00:00.000Z', now)).toBe(true);
  });

  it('returns false when start_at is in the future', () => {
    expect(hasSessionStarted('2026-05-28T05:00:00.000Z', now)).toBe(false);
  });

  it('returns false for null, undefined, or invalid start_at', () => {
    expect(hasSessionStarted(null, now)).toBe(false);
    expect(hasSessionStarted(undefined, now)).toBe(false);
    expect(hasSessionStarted('not-a-date', now)).toBe(false);
  });
});
