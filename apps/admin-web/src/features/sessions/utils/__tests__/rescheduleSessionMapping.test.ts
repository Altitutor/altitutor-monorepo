import { mapRescheduleSessionsFromRpc, parseRescheduleSessionsRpc } from '../rescheduleSessionMapping';
import { getSessionCardDisplayName } from '../session-helpers';

const rpcPayload = [
  {
    id: 'session-2',
    start_at: '2026-09-08T06:45:00+00:00',
    end_at: '2026-09-08T08:15:00+00:00',
    class_id: 'class-2',
    type: 'CLASS',
    status: 'SCHEDULED',
    subject_id: 'subject-1',
    room: 'R1',
    short_name: '12MATH tue 8 Sep 4:15',
    long_name: 'SACE 12 Mathematical Methods Tuesday 8th Sep 2026 4:15 pm - 5:45 pm',
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
    class: {
      id: 'class-2',
      day_of_week: 2,
      start_time: '16:15',
      end_time: '17:45',
      room: 'R1',
      level: null,
      status: 'ACTIVE',
      subject_id: 'subject-1',
      short_name: '12MATH tue 4:15',
      long_name: 'SACE 12 Mathematical Methods Tuesday 4:15 pm - 5:45 pm',
    },
    subject: {
      id: 'subject-1',
      name: 'Mathematical Methods',
      short_name: '12MATH',
      long_name: 'SACE 12 Mathematical Methods',
      curriculum: 'SACE',
      discipline: 'MATH',
      level: null,
      color: '#000000',
      year_level: 12,
    },
    studentCount: 4,
  },
];

describe('parseRescheduleSessionsRpc', () => {
  it('parses the JSONB array returned by get_available_reschedule_sessions', () => {
    expect(parseRescheduleSessionsRpc(rpcPayload)).toHaveLength(1);
    expect(parseRescheduleSessionsRpc(JSON.stringify(rpcPayload))[0]?.id).toBe('session-2');
    expect(parseRescheduleSessionsRpc(null)).toEqual([]);
  });
});

describe('mapRescheduleSessionsFromRpc', () => {
  it('keeps session and class names from the RPC so replacement calendar and cards can show them', () => {
    const mapped = mapRescheduleSessionsFromRpc(rpcPayload);

    expect(mapped).toHaveLength(1);
    expect(mapped[0].short_name).toBe('12MATH tue 8 Sep 4:15');
    expect(mapped[0].long_name).toBe(
      'SACE 12 Mathematical Methods Tuesday 8th Sep 2026 4:15 pm - 5:45 pm'
    );
    expect(mapped[0].class?.short_name).toBe('12MATH tue 4:15');
    expect(mapped[0].subject?.short_name).toBe('12MATH');
    expect(mapped[0].studentCount).toBe(4);

    expect(getSessionCardDisplayName(mapped[0], true)).toBe('12MATH tue 8 Sep 4:15');
    expect(getSessionCardDisplayName(mapped[0], false)).toBe(
      'SACE 12 Mathematical Methods Tuesday 8th Sep 2026 4:15 pm - 5:45 pm'
    );
  });
});
