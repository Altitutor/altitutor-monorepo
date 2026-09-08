import { parseClassesPageTab } from '../classes-page-tabs';

describe('parseClassesPageTab', () => {
  it('defaults to timetable', () => {
    expect(parseClassesPageTab(null)).toBe('timetable');
    expect(parseClassesPageTab(undefined)).toBe('timetable');
    expect(parseClassesPageTab('unknown')).toBe('timetable');
  });

  it('accepts known tabs', () => {
    expect(parseClassesPageTab('timetable')).toBe('timetable');
    expect(parseClassesPageTab('classes')).toBe('classes');
    expect(parseClassesPageTab('tutor-logs')).toBe('tutor-logs');
  });
});
