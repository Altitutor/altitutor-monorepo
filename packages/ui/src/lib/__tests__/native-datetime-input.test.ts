import { isNativeDateTimeInputType } from '../native-datetime-input';

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
