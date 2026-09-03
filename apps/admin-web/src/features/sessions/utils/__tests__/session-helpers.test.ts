import { getSessionCardDisplayName, getShortSessionName, getSessionTitle } from '../session-helpers';

describe('getSessionCardDisplayName', () => {
  it('uses session short_name in the compact calendar and long_name on the card', () => {
    const session = {
      type: 'CLASS' as const,
      short_name: '12MATH tue 4:15',
      long_name: 'SACE 12 Mathematical Methods Tuesday 4:15 pm - 5:45 pm',
      class: {
        short_name: '12MATH tue 4:15',
        long_name: 'SACE 12 Mathematical Methods Tuesday 4:15 pm - 5:45 pm',
      },
      subject: {
        short_name: '12MATH',
        long_name: 'SACE 12 Mathematical Methods',
        name: 'Mathematical Methods',
      },
    };

    expect(getSessionCardDisplayName(session, true)).toBe('12MATH tue 4:15');
    expect(getSessionCardDisplayName(session, false)).toBe(
      'SACE 12 Mathematical Methods Tuesday 4:15 pm - 5:45 pm'
    );
  });

  it('does not leave replacement-class titles blank when the RPC omits generated names', () => {
    // Shape returned today by get_available_reschedule_sessions: subject.name only.
    const rpcShapedSession = {
      type: 'CLASS' as const,
      short_name: null,
      long_name: null,
      class: {
        short_name: null,
        long_name: null,
      },
      subject: {
        name: 'Mathematical Methods',
      },
    };

    expect(getSessionCardDisplayName(rpcShapedSession, true)).toBe('Mathematical Methods');
    expect(getSessionCardDisplayName(rpcShapedSession, false)).toBe('Mathematical Methods');
  });
});

describe('getSessionTitle', () => {
  it('returns session.long_name', () => {
    expect(
      getSessionTitle({
        long_name: '  SACE 12 Mathematical Methods Tuesday 4:15 pm  ',
      } as Parameters<typeof getSessionTitle>[0])
    ).toBe('SACE 12 Mathematical Methods Tuesday 4:15 pm');
  });
});

describe('getShortSessionName', () => {
  it('prefers session.short_name', () => {
    expect(getShortSessionName({ short_name: '12MATH tue 4:15' })).toBe('12MATH tue 4:15');
  });
});
