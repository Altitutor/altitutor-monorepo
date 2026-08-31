import { classMatchesSelectedDays, classWeekdays } from '../class-day-filter';

describe('classWeekdays', () => {
  it('falls back to day_of_week when schedule_weekdays is missing', () => {
    expect(classWeekdays({ day_of_week: 1 })).toEqual([1]);
  });

  it('falls back to day_of_week when schedule_weekdays is empty', () => {
    expect(classWeekdays({ day_of_week: 3, schedule_weekdays: [] })).toEqual([3]);
  });

  it('uses schedule_weekdays when they are present', () => {
    expect(classWeekdays({ day_of_week: 1, schedule_weekdays: [1, 3] })).toEqual([1, 3]);
  });
});

describe('classMatchesSelectedDays', () => {
  it('does not throw when schedule_weekdays is undefined', () => {
    expect(() => classMatchesSelectedDays({ day_of_week: 2 }, [2])).not.toThrow();
  });

  it('matches the primary day when calendar data has no schedule_weekdays', () => {
    expect(classMatchesSelectedDays({ day_of_week: 1 }, [1])).toBe(true);
    expect(classMatchesSelectedDays({ day_of_week: 1 }, [2])).toBe(false);
  });

  it('returns all classes when no days are selected', () => {
    expect(classMatchesSelectedDays({ day_of_week: 1 }, [])).toBe(true);
  });
});
