import { parseTime, timeLabel, timeOptions } from '../time-picker';

describe('time picker scheduling values', () => {
  it.each([['9:05am', '09:05'], ['1:07 pm', '13:07'], ['12 am', '00:00'], ['12pm', '12:00'], ['23:59', '23:59']])('accepts %s as %s', (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });
  it.each(['24:00', '9:60', '13pm', '-1:00', 'noonish'])('rejects invalid input %s', (input) => {
    expect(parseTime(input)).toBeNull();
  });
  it('offers an exact minute outside the preset intervals', () => {
    expect(timeOptions('1:07pm')).toContain('13:07');
    expect(timeLabel('13:07')).toBe('1:07 pm');
  });
});
