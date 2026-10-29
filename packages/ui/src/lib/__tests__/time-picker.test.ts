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

  it.each([
    ['415', '16:15'],
    ['4', '16:00'],
    ['1615', '16:15'],
  ])('reads %s as the working-hours time %s', (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });

  it('keeps a stored 24-hour value when labelling it', () => {
    expect(parseTime('04:00')).toBe('04:00');
    expect(parseTime('04:00:00')).toBe('04:00');
    expect(timeLabel('04:00')).toBe('4:00 am');
    expect(timeLabel('04:00:00')).toBe('4:00 am');
    expect(timeLabel('16:00')).toBe('4:00 pm');
  });

  it('suggests 4:00pm before the early-morning reading', () => {
    const options = timeOptions('4');
    expect(options[0]).toBe('16:00');
    expect(options.indexOf('16:00')).toBeLessThan(options.indexOf('04:00'));
  });

  it('offers both ends of the working day for a bare 8', () => {
    const options = timeOptions('8');
    expect(options[0]).toBe('08:00');
    expect(options).toContain('20:00');
  });

  it.each([
    ['7', '19:00'],
    ['8', '08:00'],
    ['9', '09:00'],
    ['4am', '04:00'],
    ['715', '19:15'],
    ['8:15', '08:15'],
  ])('prefers the in-hours reading of %s', (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });
});
