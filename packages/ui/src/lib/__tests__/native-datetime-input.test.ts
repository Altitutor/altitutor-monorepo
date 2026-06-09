import {
  isNativeDateTimeInputType,
  isValidDateValue,
  isValidTimeValue,
  markNativeDateTimePickerActive,
  normalizeDateInput,
  normalizeTimeInput,
  resetNativeDateTimePickerStateForTests,
  scheduleNativeDateTimePickerCooldown,
  shouldPreventDialogDismissOnInteractOutside,
} from '../native-datetime-input';

describe('isNativeDateTimeInputType', () => {
  it('returns true for native date/time input types', () => {
    expect(isNativeDateTimeInputType('date')).toBe(true);
    expect(isNativeDateTimeInputType('time')).toBe(true);
    expect(isNativeDateTimeInputType('datetime-local')).toBe(true);
  });

  it('returns false for other input types', () => {
    expect(isNativeDateTimeInputType('text')).toBe(false);
    expect(isNativeDateTimeInputType(undefined)).toBe(false);
  });
});

describe('normalizeDateInput', () => {
  it('accepts valid YYYY-MM-DD values', () => {
    expect(normalizeDateInput('2026-06-09')).toBe('2026-06-09');
  });

  it('rejects invalid dates', () => {
    expect(normalizeDateInput('2026-02-30')).toBeNull();
    expect(normalizeDateInput('09/06/2026')).toBeNull();
  });
});

describe('isValidDateValue', () => {
  it('validates calendar dates', () => {
    expect(isValidDateValue('2026-06-09')).toBe(true);
    expect(isValidDateValue('2026-02-30')).toBe(false);
  });
});

describe('normalizeTimeInput', () => {
  it('accepts HH:MM values', () => {
    expect(normalizeTimeInput('9:05')).toBe('09:05');
    expect(normalizeTimeInput('09:00')).toBe('09:00');
  });

  it('accepts compact HHMM values', () => {
    expect(normalizeTimeInput('930')).toBe('09:30');
    expect(normalizeTimeInput('0930')).toBe('09:30');
  });

  it('rejects invalid times', () => {
    expect(normalizeTimeInput('25:00')).toBeNull();
    expect(normalizeTimeInput('12:99')).toBeNull();
  });
});

describe('isValidTimeValue', () => {
  it('validates 24-hour clock values', () => {
    expect(isValidTimeValue('09:00')).toBe(true);
    expect(isValidTimeValue('23:59')).toBe(true);
    expect(isValidTimeValue('24:00')).toBe(false);
  });
});

describe('dialog dismiss guard', () => {
  beforeEach(() => {
    resetNativeDateTimePickerStateForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('prevents dismiss while native picker is active', () => {
    markNativeDateTimePickerActive();
    const event = new Event('pointerdown');
    expect(shouldPreventDialogDismissOnInteractOutside(event)).toBe(true);
  });

  it('prevents dismiss briefly after native picker blur', () => {
    scheduleNativeDateTimePickerCooldown();
    const event = new Event('pointerdown');
    expect(shouldPreventDialogDismissOnInteractOutside(event)).toBe(true);

    jest.advanceTimersByTime(500);
    expect(shouldPreventDialogDismissOnInteractOutside(event)).toBe(false);
  });
});
