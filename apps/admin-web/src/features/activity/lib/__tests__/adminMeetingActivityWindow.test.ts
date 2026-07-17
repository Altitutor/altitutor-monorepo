import {
  ADMIN_MEETING_OVERRUN_GRACE_MS,
  getAdminMeetingActivityWindow,
} from '../adminMeetingActivityWindow';

describe('getAdminMeetingActivityWindow', () => {
  const now = new Date('2026-07-13T12:00:00.000Z');

  it('uses scheduled end when meeting is in the future', () => {
    const window = getAdminMeetingActivityWindow(
      '2026-07-13T14:00:00.000Z',
      '2026-07-13T15:00:00.000Z',
      now
    );
    expect(window.isLive).toBe(false);
    expect(window.start).toBe('2026-07-13T14:00:00.000Z');
    expect(window.end).toBe('2026-07-13T15:00:00.000Z');
  });

  it('uses now while meeting is in progress', () => {
    const window = getAdminMeetingActivityWindow(
      '2026-07-13T11:00:00.000Z',
      '2026-07-13T13:00:00.000Z',
      now
    );
    expect(window.isLive).toBe(true);
    expect(window.start).toBe('2026-07-13T11:00:00.000Z');
    expect(window.end).toBe(now.toISOString());
  });

  it('uses now during overrun grace after scheduled end', () => {
    const endAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const window = getAdminMeetingActivityWindow(
      '2026-07-13T09:00:00.000Z',
      endAt,
      now
    );
    expect(window.isLive).toBe(true);
    expect(window.end).toBe(now.toISOString());
  });

  it('freezes at end_at after overrun grace', () => {
    const endAt = new Date(now.getTime() - ADMIN_MEETING_OVERRUN_GRACE_MS - 60_000).toISOString();
    const window = getAdminMeetingActivityWindow(
      '2026-07-13T01:00:00.000Z',
      endAt,
      now
    );
    expect(window.isLive).toBe(false);
    expect(window.end).toBe(endAt);
  });

  it('treats missing end_at as live after start', () => {
    const window = getAdminMeetingActivityWindow('2026-07-13T11:00:00.000Z', null, now);
    expect(window.isLive).toBe(true);
    expect(window.end).toBe(now.toISOString());
  });
});
