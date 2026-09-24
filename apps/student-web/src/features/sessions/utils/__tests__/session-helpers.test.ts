import {
  collectAdjacentHomeworkHelpSessions,
  getMergedSessionTimeRange,
  getSessionTitle,
  mergeUniquePeople,
  sessionsAreBackToBack,
} from '../session-helpers';

describe('session-helpers homework help', () => {
  it('detects back-to-back sessions', () => {
    expect(
      sessionsAreBackToBack(
        { end_at: '2026-09-06T04:15:00.000Z' },
        { start_at: '2026-09-06T04:15:00.000Z' },
      ),
    ).toBe(true);
    expect(
      sessionsAreBackToBack(
        { end_at: '2026-09-06T04:15:00.000Z' },
        { start_at: '2026-09-06T04:30:00.000Z' },
      ),
    ).toBe(false);
  });

  it('collects adjacent homework help sessions into one chain', () => {
    const sessions = [
      {
        session_id: 'first',
        session_type: 'HOMEWORK_HELP',
        start_at: '2026-09-06T02:45:00.000Z',
        end_at: '2026-09-06T04:15:00.000Z',
      },
      {
        session_id: 'second',
        session_type: 'HOMEWORK_HELP',
        start_at: '2026-09-06T04:15:00.000Z',
        end_at: '2026-09-06T05:45:00.000Z',
      },
      {
        session_id: 'other-day',
        session_type: 'HOMEWORK_HELP',
        start_at: '2026-09-07T02:45:00.000Z',
        end_at: '2026-09-07T04:15:00.000Z',
      },
    ];

    expect(collectAdjacentHomeworkHelpSessions(sessions, 'first').map((s) => s.session_id)).toEqual([
      'first',
      'second',
    ]);
    expect(collectAdjacentHomeworkHelpSessions(sessions, 'second').map((s) => s.session_id)).toEqual([
      'first',
      'second',
    ]);
    expect(collectAdjacentHomeworkHelpSessions(sessions, 'other-day').map((s) => s.session_id)).toEqual([
      'other-day',
    ]);
  });

  it('merges people without duplicates', () => {
    expect(
      mergeUniquePeople([
        [{ id: '1', first_name: 'Ada', last_name: 'Lovelace' }],
        [{ id: '1', first_name: 'Ada', last_name: 'Lovelace' }, { id: '2', first_name: 'Grace', last_name: 'Hopper' }],
      ]),
    ).toEqual([
      { id: '1', first_name: 'Ada', last_name: 'Lovelace' },
      { id: '2', first_name: 'Grace', last_name: 'Hopper' },
    ]);
  });

  it('uses the earliest start and latest end across merged sessions', () => {
    expect(
      getMergedSessionTimeRange([
        {
          session_id: 'first',
          session_type: 'HOMEWORK_HELP',
          start_at: '2026-09-06T02:45:00.000Z',
          end_at: '2026-09-06T04:15:00.000Z',
        },
        {
          session_id: 'second',
          session_type: 'HOMEWORK_HELP',
          start_at: '2026-09-06T04:15:00.000Z',
          end_at: '2026-09-06T05:45:00.000Z',
        },
      ]),
    ).toEqual({
      start_at: '2026-09-06T02:45:00.000Z',
      end_at: '2026-09-06T05:45:00.000Z',
    });
  });

  it('uses a fixed homework help title', () => {
    expect(
      getSessionTitle({
        session_id: 'session-1',
        session_type: 'HOMEWORK_HELP',
        class_id: null,
        subject_id: null,
        start_at: '2026-09-06T02:45:00.000Z',
        end_at: '2026-09-06T04:15:00.000Z',
        day_of_week: 0,
        start_time: '13:15',
        end_time: '14:45',
        room: null,
        class_level: null,
        class_status: null,
        subject_name: null,
        subject_curriculum: null,
        subject_discipline: null,
        subject_level: null,
        subject_color: null,
        subject_year_level: null,
        subject_short_name: null,
        subject_long_name: null,
        long_name: 'HOMEWORK HELP Sunday 6th September 2026 1:15 pm - 2:45 pm',
      }),
    ).toBe('Homework help');
  });
});
