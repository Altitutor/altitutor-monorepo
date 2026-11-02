import {
  addMinutesToTime,
  durationLabel,
  durationMinutesBetween,
  durationOptions,
  parseDurationMinutes,
  shiftStartKeepingDuration,
} from '../duration-picker';

describe('duration picker', () => {
  it('keeps the existing presets when nothing is typed', () => {
    expect(durationOptions('')).toEqual([15, 30, 45, 60, 90, 120]);
  });

  it('accepts a typed minute count that is not a preset', () => {
    expect(parseDurationMinutes('301')).toBe(301);
    expect(parseDurationMinutes('301 minutes')).toBe(301);
    expect(durationOptions('301')).toEqual([301]);
    expect(durationLabel(301)).toBe('301 minutes');
  });

  it('lists the typed count before presets that share its digits', () => {
    expect(durationOptions('3')).toEqual([3, 30]);
    expect(durationOptions('1')).toEqual([1, 15, 120]);
    expect(durationOptions('60')).toEqual([60]);
  });

  it('keeps a custom current duration visible beside the presets', () => {
    expect(durationOptions('', 301)).toEqual([301, 15, 30, 45, 60, 90, 120]);
    expect(durationOptions('', 60)).toEqual([15, 30, 45, 60, 90, 120]);
  });

  it.each(['0', '1440', '3.5', 'an hour', ''])('rejects %s', (input) => {
    expect(parseDurationMinutes(input)).toBeNull();
  });

  it('derives a same-day length from a start and end', () => {
    expect(durationMinutesBetween('16:00', '17:30')).toBe(90);
    expect(durationMinutesBetween('16:00:00', '17:30:00')).toBe(90);
    expect(durationMinutesBetween('17:00', '17:00')).toBeNull();
    expect(addMinutesToTime('16:00', 90)).toBe('17:30');
    expect(addMinutesToTime('16:00', 301)).toBe('21:01');
    expect(addMinutesToTime('23:00', 120)).toBeNull();
  });

  it('keeps the length when the start moves, and refuses a length that leaves the day', () => {
    expect(shiftStartKeepingDuration('16:00', '17:30', '18:00')).toEqual({
      startTime: '18:00',
      endTime: '19:30',
    });
    expect(shiftStartKeepingDuration('16:00', '17:30', '23:30')).toBeNull();
  });
});
