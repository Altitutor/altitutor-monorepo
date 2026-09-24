import { format } from 'date-fns';
import { adminMeetingStartAtToDate } from '../lastAdminMeeting';

describe('adminMeetingStartAtToDate', () => {
  it('maps a UTC instant onto the Adelaide calendar date', () => {
    // 14:29 UTC on 16 Aug 2026 is 23:59 ACST (UTC+9:30) — still 16 Aug in Adelaide.
    const date = adminMeetingStartAtToDate('2026-08-16T14:29:59.000Z');
    expect(date).not.toBeNull();
    expect(format(date!, 'yyyy-MM-dd')).toBe('2026-08-16');
  });

  it('rolls forward when Adelaide is already on the next calendar day', () => {
    // 14:30 UTC on 16 Aug 2026 is 00:00 ACST — 17 Aug in Adelaide.
    const date = adminMeetingStartAtToDate('2026-08-16T14:30:00.000Z');
    expect(date).not.toBeNull();
    expect(format(date!, 'yyyy-MM-dd')).toBe('2026-08-17');
  });

  it('returns null for an invalid timestamp', () => {
    expect(adminMeetingStartAtToDate('not-a-date')).toBeNull();
  });
});
