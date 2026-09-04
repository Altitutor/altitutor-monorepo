import { getResourceMetricBreakdown, getSessionMetricBreakdown } from '../payTierMetricBreakdowns';

describe('getSessionMetricBreakdown', () => {
  it('uses session aggregates for totals without double-counting attendance roles', () => {
    const result = getSessionMetricBreakdown({
      'sessions.CLASS.MAIN_TUTOR': 7,
      'sessions.CLASS.SECONDARY_TUTOR': 3,
      'sessions.CLASS.any': 10,
      'sessions.HOMEWORK_HELP.any': 4,
      'sessions.teaching.all': 10,
    });

    expect(result.total).toBe(14);
    expect(result.items).toEqual([
      {
        key: 'CLASS',
        label: 'Class',
        value: 10,
        attendance: [
          { key: 'MAIN_TUTOR', label: 'Main tutor', value: 7 },
          { key: 'SECONDARY_TUTOR', label: 'Secondary tutor', value: 3 },
        ],
      },
      {
        key: 'HOMEWORK_HELP',
        label: 'Homework Help',
        value: 4,
        attendance: [],
      },
    ]);
  });

  it('falls back to attendance totals when a session aggregate is absent', () => {
    const result = getSessionMetricBreakdown({
      'sessions.DRAFTING.MAIN_TUTOR': 2,
      'sessions.DRAFTING.TRIAL_TUTOR': 1,
    });

    expect(result.total).toBe(3);
    expect(result.items[0]?.value).toBe(3);
  });
});

describe('getResourceMetricBreakdown', () => {
  it('combines subject-specific metrics by resource type and reports a total', () => {
    const result = getResourceMetricBreakdown({
      'resources.created.subject.maths.type.NOTES': 4,
      'resources.created.subject.english.type.NOTES': 2,
      'resources.created.subject.maths.type.PRACTICE_QUESTIONS': 5,
      'resources.created.subject.UNKNOWN.type.UNKNOWN': 1,
    });

    expect(result).toEqual({
      total: 12,
      items: [
        { key: 'NOTES', label: 'Notes', value: 6 },
        { key: 'PRACTICE_QUESTIONS', label: 'Practice questions', value: 5 },
        { key: 'UNKNOWN', label: 'Unknown legacy type', value: 1 },
      ],
    });
  });
});
