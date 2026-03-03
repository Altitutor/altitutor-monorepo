/**
 * Tests for time-utils
 */

import {
  parseTimeToSeconds,
  minutesSecondsToTotal,
  secondsToTimeString,
  formatSecondsToDuration,
} from '../time-utils';

describe('parseTimeToSeconds', () => {
  it('parses mm:ss format', () => {
    expect(parseTimeToSeconds('1:30')).toBe(90);
    expect(parseTimeToSeconds('0:45')).toBe(45);
  });

  it('parses seconds only', () => {
    expect(parseTimeToSeconds('90')).toBe(90);
    expect(parseTimeToSeconds('0')).toBe(0);
  });

  it('returns null for empty string', () => {
    expect(parseTimeToSeconds('')).toBe(null);
    expect(parseTimeToSeconds('   ')).toBe(null);
  });

  it('returns null for invalid input', () => {
    expect(parseTimeToSeconds('abc')).toBe(null);
    expect(parseTimeToSeconds('1:abc')).toBe(null);
  });
});

describe('minutesSecondsToTotal', () => {
  it('converts minutes and seconds', () => {
    expect(minutesSecondsToTotal('1', '30')).toBe(90);
  });

  it('treats empty as 0', () => {
    expect(minutesSecondsToTotal('1', '')).toBe(60);
    expect(minutesSecondsToTotal('', '30')).toBe(30);
  });

  it('returns null when both empty', () => {
    expect(minutesSecondsToTotal('', '')).toBe(null);
  });
});

describe('secondsToTimeString', () => {
  it('formats as mm:ss', () => {
    expect(secondsToTimeString(90)).toBe('1:30');
    expect(secondsToTimeString(65)).toBe('1:05');
  });

  it('returns empty for null/undefined/negative', () => {
    expect(secondsToTimeString(null)).toBe('');
    expect(secondsToTimeString(undefined)).toBe('');
    expect(secondsToTimeString(-1)).toBe('');
  });
});

describe('formatSecondsToDuration', () => {
  it('formats as "Xm Ys"', () => {
    expect(formatSecondsToDuration(90)).toBe('1m 30s');
    expect(formatSecondsToDuration(30)).toBe('30s'); // m=0 omitted per implementation
  });

  it('returns "-" for null/undefined/negative', () => {
    expect(formatSecondsToDuration(null)).toBe('-');
    expect(formatSecondsToDuration(undefined)).toBe('-');
    expect(formatSecondsToDuration(-1)).toBe('-');
  });
});
